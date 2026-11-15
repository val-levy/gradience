// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title PredictionPerps
/// @notice Leveraged perps on prediction-market contracts (price 0..1e18 = 0..100c).
///         The house (owner-funded vault) is counterparty to every trade.
///         Prices come from a quorum of EIP-712 signers (median); a finalized update settles
///         the market at exactly 0 or 1e18.
/// @dev    TESTNET PROTOTYPE. Native MON collateral, owner = single admin (no timelock), unaudited.
contract PredictionPerps {
    uint256 public constant ONE = 1e18;
    uint256 internal constant BPS = 10_000;
    uint256 public constant MIN_PRICE = 3e16; // can only open between 3c and 97c
    uint256 public constant MAX_PRICE = 97e16;
    uint256 public constant GRACE = 7 days; // after expiry w/o settlement, positions may exit at last index

    struct Market {
        string name; //          e.g. "GEMI-BTC2611160000-HI65000"
        uint64 expiry;
        uint64 priceTime;
        bool settled;
        uint128 indexPrice; //   oracle median
        uint128 settlePrice; //  0 or ONE once settled
        uint128 longOI; //       notional, MON wei
        uint128 shortOI;
        uint128 oiCap; //        max per-side OI and max |net|
        uint128 skewFactor; //   mark = index + skewFactor * net/oiCap   (0 = off)
        uint128 fundingPerDay; // funding rate at net == oiCap, 1e18 = 100%/day (0 = off)
        uint64 fundingTime;
        int256 cumFunding; //    1e18-scaled fraction of notional; heavy side pays
    }

    struct Position {
        address trader;
        uint32 marketId;
        bool isLong; // long YES / short YES (=long NO)
        bool open;
        uint128 collateral;
        uint128 notional;
        uint128 entryPrice;
        uint128 maxProfit; // reserved from the house at open
        int256 fundingEntry;
    }

    struct SignedPrice {
        uint128 price;
        uint64 timestamp;
        bool finalized;
        bytes sig;
    }

    address public owner;
    Market[] public markets;
    Position[] public positions;
    mapping(address => uint256[]) internal _userPositions;
    mapping(address => uint256) public claimable; // payouts whose transfer failed

    uint256 public houseBalance; // house funds (excludes open trader collateral)
    int256 public netDeposited; //  deposits - withdrawals; realized house P&L = houseBalance - netDeposited
    uint256 public reserved; //     sum of open positions' maxProfit; always <= houseBalance

    // params (owner-tunable)
    uint256 public feeBps = 5;
    uint256 public maintBps = 100; // 1% of notional
    uint256 public liqRewardBps = 50; // 0.5% of notional, paid from remaining equity
    uint256 public maxLeverage = 25; // initial margin 4% > maintenance 1%
    uint256 public maxStale = 5 minutes;

    // oracle
    mapping(address => bool) public isSigner;
    uint256 public signerCount;
    uint256 public quorum = 1;
    bytes32 public immutable DOMAIN_SEPARATOR;
    bytes32 public constant UPDATE_TYPEHASH =
        keccak256("PriceUpdate(uint256 marketId,uint256 price,uint256 timestamp,bool finalized)");

    uint256 private _lock = 1;

    event MarketCreated(uint256 indexed marketId, string name, uint64 expiry, uint128 indexPrice);
    event PriceUpdated(uint256 indexed marketId, uint128 price, uint64 timestamp);
    event MarketSettled(uint256 indexed marketId, uint128 settlePrice);
    event PositionOpened(
        uint256 indexed id, uint256 indexed marketId, address indexed trader, bool isLong,
        uint128 collateral, uint128 notional, uint128 entryPrice
    );
    /// @param reason 0 = closed by trader, 1 = liquidated, 2 = settled/expired
    event PositionClosed(
        uint256 indexed id, uint256 indexed marketId, address indexed trader,
        uint256 payout, int256 houseDelta, uint8 reason
    );
    event HouseDeposit(uint256 amount);
    event HouseWithdraw(uint256 amount);

    modifier onlyOwner() { require(msg.sender == owner, "not owner"); _; }
    modifier nonReentrant() { require(_lock == 1, "reentrant"); _lock = 2; _; _lock = 1; }

    constructor() {
        owner = msg.sender;
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("PredictionPerps"), keccak256("1"), block.chainid, address(this)
            )
        );
    }

    // ───────────────────────── admin ─────────────────────────

    function transferOwnership(address to) external onlyOwner { require(to != address(0)); owner = to; }

    function setParams(uint256 fee, uint256 maint, uint256 liqReward, uint256 maxLev, uint256 stale) external onlyOwner {
        require(fee <= 100 && maint >= 10 && maint * 2 <= BPS / maxLev && liqReward <= maint && maxLev >= 1 && stale > 0, "bad params");
        (feeBps, maintBps, liqRewardBps, maxLeverage, maxStale) = (fee, maint, liqReward, maxLev, stale);
    }

    function setSigner(address s, bool on) external onlyOwner {
        require(s != address(0) && isSigner[s] != on, "no change");
        isSigner[s] = on;
        signerCount = on ? signerCount + 1 : signerCount - 1;
    }

    function setQuorum(uint256 q) external onlyOwner { require(q >= 1 && q <= signerCount, "bad quorum"); quorum = q; }

    function createMarket(
        string calldata name, uint64 expiry, uint128 initialPrice,
        uint128 oiCap, uint128 skewFactor, uint128 fundingPerDay
    ) external onlyOwner returns (uint256 id) {
        require(expiry > block.timestamp && initialPrice > 0 && initialPrice < ONE && oiCap > 0, "invalid market");
        id = markets.length;
        markets.push(Market(name, expiry, uint64(block.timestamp), false, initialPrice, 0, 0, 0, oiCap, skewFactor, fundingPerDay, uint64(block.timestamp), 0));
        emit MarketCreated(id, name, expiry, initialPrice);
    }

    function setMarketParams(uint256 id, uint128 oiCap, uint128 skewFactor, uint128 fundingPerDay) external onlyOwner {
        Market storage m = markets[id];
        require(oiCap >= m.longOI && oiCap >= m.shortOI && oiCap > 0, "oi below open");
        _accrue(m); // settle funding at the old rate first
        (m.oiCap, m.skewFactor, m.fundingPerDay) = (oiCap, skewFactor, fundingPerDay);
    }

    function depositHouse() external payable onlyOwner {
        houseBalance += msg.value;
        netDeposited += int256(msg.value);
        emit HouseDeposit(msg.value);
    }

    function withdrawHouse(uint256 amount) external onlyOwner nonReentrant {
        require(houseBalance - reserved >= amount, "funds reserved");
        houseBalance -= amount;
        netDeposited -= int256(amount);
        _pay(owner, amount);
        emit HouseWithdraw(amount);
    }

    // ───────────────────────── oracle ─────────────────────────

    /// @notice Anyone may relay. Needs >= quorum distinct signers (ascending address order). Median wins.
    function updatePrice(uint256 marketId, SignedPrice[] calldata ups) external {
        Market storage m = markets[marketId];
        require(!m.settled, "settled");
        uint256 n = ups.length;
        require(n >= quorum, "below quorum");
        uint256[] memory prices = new uint256[](n);
        uint64 ts = type(uint64).max;
        address last;
        bool fin = ups[0].finalized;
        for (uint256 i; i < n; i++) {
            SignedPrice calldata u = ups[i];
            require(u.finalized == fin && u.price <= ONE, "bad price"); // range re-checked on the median below
            require(u.timestamp <= block.timestamp && block.timestamp - u.timestamp <= maxStale, "stale");
            address s = _recover(marketId, u);
            require(isSigner[s] && s > last, "bad signer");
            last = s;
            prices[i] = u.price;
            if (u.timestamp < ts) ts = u.timestamp;
        }
        require(ts > m.priceTime, "not newer");
        _accrue(m);
        uint256 med = _median(prices);
        m.priceTime = ts;
        if (fin) {
            require(med == 0 || med == ONE, "final must be 0 or 1");
            m.settled = true;
            m.settlePrice = uint128(med);
            m.indexPrice = uint128(med);
            emit MarketSettled(marketId, uint128(med));
        } else {
            require(med > 0 && med < ONE, "price range");
            m.indexPrice = uint128(med);
        }
        emit PriceUpdated(marketId, m.indexPrice, ts);
    }

    function _recover(uint256 marketId, SignedPrice calldata u) internal view returns (address) {
        bytes memory sig = u.sig;
        require(sig.length == 65, "sig len");
        bytes32 r; bytes32 s; uint8 v;
        assembly {
            r := mload(add(sig, 0x20))
            s := mload(add(sig, 0x40))
            v := byte(0, mload(add(sig, 0x60)))
        }
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01", DOMAIN_SEPARATOR,
                keccak256(abi.encode(UPDATE_TYPEHASH, marketId, uint256(u.price), uint256(u.timestamp), u.finalized))
            )
        );
        return ecrecover(digest, v, r, s);
    }

    function _median(uint256[] memory a) internal pure returns (uint256) {
        for (uint256 i = 1; i < a.length; i++) {
            uint256 k = a[i];
            uint256 j = i;
            while (j > 0 && a[j - 1] > k) { a[j] = a[j - 1]; j--; }
            a[j] = k;
        }
        uint256 n = a.length;
        return n % 2 == 1 ? a[n / 2] : (a[n / 2 - 1] + a[n / 2]) / 2;
    }

    // ───────────────────────── trading ─────────────────────────

    /// @notice Send MON as margin+fee. Notional = margin * leverage.
    /// @param limitPrice worst acceptable entry (1e18): longs revert above it, shorts revert below it (slippage guard).
    function openPosition(uint256 marketId, bool isLong, uint256 leverage, uint256 limitPrice) external payable nonReentrant returns (uint256 id) {
        Market storage m = markets[marketId];
        require(!m.settled && block.timestamp < m.expiry, "market closed");
        require(block.timestamp - m.priceTime <= maxStale, "stale price");
        require(leverage >= 1 && leverage <= maxLeverage, "bad leverage");
        _accrue(m);

        uint256 collateral = msg.value * BPS / (BPS + leverage * feeBps);
        uint256 notional = collateral * leverage;
        require(collateral > 0, "no margin");
        houseBalance += msg.value - collateral; // fee

        if (isLong) m.longOI += uint128(notional); else m.shortOI += uint128(notional);
        require(m.longOI <= m.oiCap && m.shortOI <= m.oiCap, "oi cap");
        int256 net = int256(uint256(m.longOI)) - int256(uint256(m.shortOI));
        require(net <= int256(uint256(m.oiCap)) && -net <= int256(uint256(m.oiCap)), "skew cap");

        uint256 entry = _mark(m, net); // price impact includes this trade
        require(entry >= MIN_PRICE && entry <= MAX_PRICE, "price at edge");
        require(isLong ? entry <= limitPrice : entry >= limitPrice, "slippage");
        uint256 maxProfit = isLong ? notional * (ONE - entry) / entry : notional * entry / (ONE - entry);
        require(houseBalance - reserved >= maxProfit, "house capacity");
        reserved += maxProfit;

        id = positions.length;
        positions.push(Position(msg.sender, uint32(marketId), isLong, true, uint128(collateral), uint128(notional), uint128(entry), uint128(maxProfit), m.cumFunding));
        _userPositions[msg.sender].push(id);
        emit PositionOpened(id, marketId, msg.sender, isLong, uint128(collateral), uint128(notional), uint128(entry));
    }

    /// @notice Trader closes at mark. Anyone may close a settled (or long-expired) market's position for the trader.
    function closePosition(uint256 id) external nonReentrant {
        Position memory p = positions[id];
        require(p.open, "closed");
        Market storage m = markets[p.marketId];
        bool settled = m.settled;
        bool graced = block.timestamp > m.expiry + GRACE;
        require(settled || block.timestamp < m.expiry || graced, "awaiting settlement");
        require(msg.sender == p.trader || settled || graced, "not trader");
        _accrue(m);
        uint256 price;
        uint256 fee;
        if (settled) price = m.settlePrice;
        else if (graced) price = m.indexPrice;
        else {
            price = _mark(m, int256(uint256(m.longOI)) - int256(uint256(m.shortOI)));
            fee = feeBps;
        }
        _close(id, p, m, price, fee, settled || graced ? 2 : 0, address(0));
    }

    /// @notice Anyone may liquidate a position whose equity at the index is below maintenance margin.
    function liquidate(uint256 id) external nonReentrant {
        Position memory p = positions[id];
        require(p.open, "closed");
        Market storage m = markets[p.marketId];
        require(!m.settled && block.timestamp < m.expiry, "market closed");
        require(block.timestamp - m.priceTime <= maxStale, "stale price");
        _accrue(m);
        require(_equity(p, m, m.indexPrice, 0) < int256(uint256(p.notional) * maintBps / BPS), "healthy");
        _close(id, p, m, m.indexPrice, 0, 1, msg.sender);
    }

    function _close(uint256 id, Position memory p, Market storage m, uint256 price, uint256 closeFeeBps, uint8 reason, address liquidator) internal {
        int256 eq = _equity(p, m, price, closeFeeBps);
        uint256 cap = uint256(p.collateral) + p.maxProfit;
        uint256 payout = eq <= 0 ? 0 : (uint256(eq) > cap ? cap : uint256(eq));

        positions[id].open = false;
        if (p.isLong) m.longOI -= p.notional; else m.shortOI -= p.notional;
        reserved -= p.maxProfit;
        houseBalance = houseBalance + p.collateral - payout; // safe: houseBalance >= reserved >= maxProfit

        uint256 reward;
        if (reason == 1) {
            reward = uint256(p.notional) * liqRewardBps / BPS;
            if (reward > payout) reward = payout;
        }
        if (payout - reward > 0) _pay(p.trader, payout - reward);
        if (reward > 0) _pay(liquidator, reward);
        emit PositionClosed(id, p.marketId, p.trader, payout, int256(uint256(p.collateral)) - int256(payout), reason);
    }

    function claim() external nonReentrant {
        uint256 amt = claimable[msg.sender];
        require(amt > 0, "nothing");
        claimable[msg.sender] = 0;
        (bool ok,) = msg.sender.call{value: amt}("");
        require(ok, "transfer failed");
    }

    function _pay(address to, uint256 amt) internal {
        (bool ok,) = to.call{value: amt}("");
        if (!ok) claimable[to] += amt; // a rejecting wallet can't block liquidations/settlement
    }

    // ───────────────────────── math ─────────────────────────

    function _accrue(Market storage m) internal {
        uint256 dt = block.timestamp - m.fundingTime;
        if (dt == 0) return;
        m.fundingTime = uint64(block.timestamp);
        if (m.fundingPerDay == 0 || m.settled) return;
        int256 net = int256(uint256(m.longOI)) - int256(uint256(m.shortOI));
        m.cumFunding += net * int256(uint256(m.fundingPerDay)) / int256(uint256(m.oiCap)) * int256(dt) / 1 days;
    }

    function _mark(Market storage m, int256 net) internal view returns (uint256) {
        int256 p = int256(uint256(m.indexPrice)) + int256(uint256(m.skewFactor)) * net / int256(uint256(m.oiCap));
        if (p < 1) return 1;
        if (p > int256(ONE) - 1) return ONE - 1;
        return uint256(p);
    }

    function _pnl(Position memory p, uint256 price) internal pure returns (int256) {
        int256 n = int256(uint256(p.notional));
        int256 e = int256(uint256(p.entryPrice));
        int256 px = int256(price);
        return p.isLong ? n * (px - e) / e : n * (e - px) / (int256(ONE) - e);
    }

    function _fundingOwed(Position memory p, Market storage m) internal view returns (int256) {
        int256 f = int256(uint256(p.notional)) * (m.cumFunding - p.fundingEntry) / int256(ONE);
        return p.isLong ? f : -f;
    }

    function _equity(Position memory p, Market storage m, uint256 price, uint256 closeFeeBps) internal view returns (int256) {
        return int256(uint256(p.collateral)) + _pnl(p, price) - _fundingOwed(p, m) - int256(uint256(p.notional) * closeFeeBps / BPS);
    }

    // ───────────────────────── views ─────────────────────────

    function marketCount() external view returns (uint256) { return markets.length; }
    function positionCount() external view returns (uint256) { return positions.length; }
    function userPositionIds(address a) external view returns (uint256[] memory) { return _userPositions[a]; }

    function markPrice(uint256 id) external view returns (uint256) {
        Market storage m = markets[id];
        if (m.settled) return m.settlePrice;
        return _mark(m, int256(uint256(m.longOI)) - int256(uint256(m.shortOI)));
    }

    /// @return pnl unrealized PnL at the index (before funding), funding owed by the trader, equity net of both, liquidatable flag
    function positionHealth(uint256 id) external view returns (int256 pnl, int256 funding, int256 equity, bool liquidatable) {
        Position memory p = positions[id];
        Market storage m = markets[p.marketId];
        uint256 price = m.settled ? m.settlePrice : m.indexPrice;
        // include funding accrued since last touch
        int256 pending;
        if (!m.settled && m.fundingPerDay != 0) {
            int256 net = int256(uint256(m.longOI)) - int256(uint256(m.shortOI));
            pending = net * int256(uint256(m.fundingPerDay)) / int256(uint256(m.oiCap)) * int256(block.timestamp - m.fundingTime) / 1 days;
        }
        int256 f = int256(uint256(p.notional)) * (m.cumFunding + pending - p.fundingEntry) / int256(ONE);
        funding = p.isLong ? f : -f;
        pnl = _pnl(p, price);
        equity = int256(uint256(p.collateral)) + pnl - funding;
        liquidatable = p.open && !m.settled && equity < int256(uint256(p.notional) * maintBps / BPS);
    }
}
