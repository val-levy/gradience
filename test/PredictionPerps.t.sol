// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PredictionPerps} from "../contracts/PredictionPerps.sol";

interface Vm {
    function warp(uint256) external;
    function deal(address, uint256) external;
    function prank(address) external;
    function sign(uint256 pk, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function addr(uint256 pk) external returns (address);
    function expectRevert(bytes calldata) external;
}

contract PredictionPerpsTest {
    Vm constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);
    PredictionPerps p;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address keeper = address(0xBEEF);
    uint256 pk1 = 0x1111;
    uint256 pk2 = 0x2222;
    uint256 pk3 = 0x3333;

    receive() external payable {}

    function setUp() public {
        vm.warp(1_000_000);
        p = new PredictionPerps();
        vm.deal(address(this), 1000 ether);
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        p.depositHouse{value: 500 ether}();
        p.setSigner(vm.addr(pk1), true);
        p.setSigner(vm.addr(pk2), true);
        p.setSigner(vm.addr(pk3), true);
        p.setQuorum(2);
        // market 0: 50c, oiCap 100 MON notional-ish, skew & funding off
        p.createMarket("TEST-50", uint64(block.timestamp + 30 days), 0.5e18, 1000 ether, 0, 0);
    }

    // ── helpers ──
    function _ok(bool c, string memory m) internal pure { require(c, m); }

    function _sig(uint256 pk, uint256 id, uint128 price, uint64 ts, bool fin) internal returns (PredictionPerps.SignedPrice memory u) {
        bytes32 digest = keccak256(abi.encodePacked(
            "\x19\x01", p.DOMAIN_SEPARATOR(),
            keccak256(abi.encode(p.UPDATE_TYPEHASH(), id, uint256(price), uint256(ts), fin))
        ));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        u = PredictionPerps.SignedPrice(price, ts, fin, abi.encodePacked(r, s, v));
    }

    /// two signers (pk1,pk2 sorted by address) report the same price
    function _push(uint256 id, uint128 price, bool fin) internal {
        _push3(id, price, price, fin);
    }

    function _push3(uint256 id, uint128 a, uint128 b, bool fin) internal {
        uint256 ka = pk1; uint256 kb = pk2;
        if (vm.addr(ka) > vm.addr(kb)) (ka, kb) = (kb, ka);
        PredictionPerps.SignedPrice[] memory ups = new PredictionPerps.SignedPrice[](2);
        ups[0] = _sig(ka, id, a, uint64(block.timestamp), fin);
        ups[1] = _sig(kb, id, b, uint64(block.timestamp), fin);
        p.updatePrice(id, ups);
    }

    function _open(address who, bool isLong, uint256 lev, uint256 value) internal returns (uint256 id) {
        vm.prank(who);
        id = p.openPosition{value: value}(0, isLong, lev);
    }

    function _tick() internal { vm.warp(block.timestamp + 1); }

    function _solvent() internal view {
        _ok(p.houseBalance() >= p.reserved(), "house < reserved");
    }

    // ── tests ──

    function testLongProfitClose() public {
        uint256 id = _open(alice, true, 10, 10 ether); // entry 50c
        _tick(); _push(0, 0.6e18, false);
        uint256 before = alice.balance;
        vm.prank(alice); p.closePosition(id);
        // collateral ~9.99, notional ~99.9, pnl = notional*(0.1/0.5)=+~19.98, minus 0.05% close fee
        uint256 gain = alice.balance - before;
        _ok(gain > 29 ether && gain < 30 ether, "long payout out of range");
        _ok(p.reserved() == 0, "reserve not released");
        _solvent();
    }

    function testShortProfitClose() public {
        uint256 id = _open(bob, false, 5, 10 ether);
        _tick(); _push(0, 0.4e18, false);
        uint256 before = bob.balance;
        vm.prank(bob); p.closePosition(id);
        _ok(bob.balance - before > 19 ether, "short should profit");
        _solvent();
    }

    function testLiquidationPaysKeeperAndHouse() public {
        uint256 id = _open(alice, true, 25, 10 ether); // maint 1% of notional -> ~3% adverse move
        _tick(); _push(0, 0.4e18, false); // -20% price = deeply underwater
        uint256 hb = p.houseBalance();
        vm.prank(keeper); p.liquidate(id);
        _ok(p.houseBalance() > hb, "house should gain collateral");
        _ok(p.reserved() == 0, "reserve not released");
        _solvent();
    }

    function testCannotLiquidateHealthy() public {
        uint256 id = _open(alice, true, 5, 10 ether);
        vm.expectRevert(bytes("healthy"));
        p.liquidate(id);
    }

    function testSettleYesPaysLongAndLocksMarket() public {
        uint256 id = _open(alice, true, 10, 10 ether);
        uint256 idShort = _open(bob, false, 10, 10 ether);
        _tick(); _push(0, 1e18, true); // YES resolved
        _ok(p.markPrice(0) == 1e18, "mark != settle"); // index set to 1
        uint256 a0 = alice.balance;
        uint256 b0 = bob.balance;
        p.closePosition(id); // anyone can close after settlement
        p.closePosition(idShort);
        _ok(alice.balance > a0 + 99 ether, "long should win ~notional"); // +notional*(1-0.5)/0.5 = ~+99.9
        _ok(bob.balance == b0, "short loses all collateral");
        _solvent();
        vm.expectRevert(bytes("market closed"));
        this.openFromAlice();
    }

    function openFromAlice() external payable { vm.prank(alice); p.openPosition{value: 1 ether}(0, true, 2); }

    function testOracleMedianAndQuorum() public {
        _tick(); _push3(0, 0.45e18, 0.55e18, false);
        (, , , , uint128 idx, , , , , , , , ) = p.markets(0);
        _ok(idx == 0.5e18, "median of two = mean");
        // single signature below quorum
        _tick();
        PredictionPerps.SignedPrice[] memory one = new PredictionPerps.SignedPrice[](1);
        one[0] = _sig(pk1, 0, 0.7e18, uint64(block.timestamp), false);
        vm.expectRevert(bytes("below quorum"));
        p.updatePrice(0, one);
    }

    function testRejectsUnknownSignerAndReplay() public {
        _tick();
        PredictionPerps.SignedPrice[] memory ups = new PredictionPerps.SignedPrice[](2);
        ups[0] = _sig(0x9999, 0, 0.6e18, uint64(block.timestamp), false);
        ups[1] = _sig(0x9998, 0, 0.6e18, uint64(block.timestamp), false);
        vm.expectRevert(bytes("bad signer"));
        p.updatePrice(0, ups);
        _push(0, 0.6e18, false);
        vm.expectRevert(bytes("not newer"));
        this.replay();
    }

    function replay() external { _push(0, 0.7e18, false); }

    function testEdgeAndHouseCapacity() public {
        _tick(); _push(0, 0.98e18, false);
        vm.expectRevert(bytes("price at edge"));
        this.openFromAlice();
        _tick(); _push(0, 0.5e18, false);
        // house capacity: 25x on 100 MON margin at 50c -> max profit ~2500 > 500 house
        vm.deal(alice, 1000 ether);
        vm.expectRevert(bytes("house capacity"));
        this.bigOpen();
    }

    function bigOpen() external payable { vm.prank(alice); p.openPosition{value: 30 ether}(0, true, 25); }

    function testSkewMovesEntryAndFundingFlows() public {
        p.setMarketParams(0, 1000 ether, 0.1e18, 1e18); // 10c impact at full cap, 100%/day funding at full skew
        uint256 id = _open(alice, true, 10, 20 ether); // ~200 notional => net 0.2 cap => +2c skew
        (, , , , , , uint128 entry, , ) = p.positions(id);
        _ok(entry > 0.51e18 && entry < 0.53e18, "skewed entry");
        vm.warp(block.timestamp + 1 days);
        _push(0, 0.5e18, false);
        (, int256 funding, , ) = p.positionHealth(id);
        _ok(funding > 0, "heavy long pays funding");
        // reversibility: closing right away at same skew only costs fees
        uint256 id2 = _open(bob, false, 10, 20 ether);
        vm.prank(bob); p.closePosition(id2);
        _solvent();
    }

    function testGracePeriodExit() public {
        uint256 id = _open(alice, true, 3, 10 ether);
        vm.warp(block.timestamp + 31 days);
        vm.prank(alice);
        vm.expectRevert(bytes("awaiting settlement"));
        this.closeAsAlice(id);
        vm.warp(block.timestamp + 8 days);
        p.closePosition(id); // fail-safe exit at last index
        _solvent();
    }

    function closeAsAlice(uint256 id) external { p.closePosition(id); }

    function testHouseWithdrawRespectsReserve() public {
        _open(alice, true, 10, 10 ether);
        vm.expectRevert(bytes("funds reserved"));
        p.withdrawHouse(500 ether);
        p.withdrawHouse(400 ether);
    }

    /// invariant-ish fuzz: random price walk, open/close everyone, house must never go below reserved and ends consistent
    function testFuzzWalkKeepsHouseSolvent(uint256 seed) public {
        uint256[] memory ids = new uint256[](6);
        for (uint256 i; i < 6; i++) ids[i] = _open(i % 2 == 0 ? alice : bob, i % 3 != 0, 1 + (seed >> (i * 4)) % 25, 3 ether);
        uint256 px = 0.5e18;
        for (uint256 s; s < 8; s++) {
            _tick();
            uint256 r = uint256(keccak256(abi.encode(seed, s)));
            px = 0.05e18 + (r % 0.9e18);
            _push(0, uint128(px), false);
            _solvent();
            for (uint256 i; i < 6; i++) {
                (,,, bool open,,,,,) = p.positions(ids[i]);
                if (open && uint256(keccak256(abi.encode(r, i))) % 2 == 0) {
                    try p.liquidate(ids[i]) {} catch {}
                }
            }
            _solvent();
        }
        _tick(); _push(0, seed % 2 == 0 ? 1e18 : 0, true);
        for (uint256 i; i < 6; i++) { (,,, bool open,,,,,) = p.positions(ids[i]); if (open) p.closePosition(ids[i]); }
        _ok(p.reserved() == 0, "reserve leaked");
        _ok(address(p).balance >= p.houseBalance(), "contract underfunded");
    }
}
