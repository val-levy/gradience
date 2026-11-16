// On-chain glue: syncs contract markets into the UI, renders My positions and the House dashboard.
// Shares globals (markets, active, walletAddress, connected, walletProvider, render…) with main.js.
let chainMarkets = [],
  houseInfo = null,
  buyingPower = null, // wallet MON balance; null until loaded
  myOpen = [], // the connected wallet's open positions

  refreshing = false;

const fmt = (n, d = 3) => Number(n).toLocaleString(undefined, { maximumFractionDigits: d });
const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const signed = (n) => `<b class="${n >= 0 ? "up" : "down"}">${n >= 0 ? "+" : ""}${fmt(n)}</b>`;
const marketName = (idx) => {
  const n = chainMarkets[idx]?.name;
  return escapeHTML(n === undefined ? `#${idx}` : (symbolInfo[n]?.title ?? n));
};
const isOwner = () =>
  Boolean(houseInfo && walletAddress && houseInfo.owner.toLowerCase() === walletAddress.toLowerCase());
const age = (t) => {
  const s = Math.max(0, Math.floor(Date.now() / 1000) - t);
  return s < 90 ? `${s}s ago` : s < 5400 ? `${Math.round(s / 60)}m ago` : `${Math.round(s / 3600)}h ago`;
};

// Payoff of a position if the market settles at px (cents), clamped like the contract (loss ≤ margin, win ≤ maxProfit).
function payoffAt(p, px) {
  const e = p.entry / 100,
    x = px / 100;
  const raw = p.isLong ? (p.notional * (x - e)) / e : (p.notional * (e - x)) / (1 - e);
  return Math.max(-p.collateral, Math.min(p.maxProfit, raw));
}

function toUiMarket(m) {
  const old = markets.find((x) => x.chainIdx === m.idx);
  const status = m.settled ? `SETTLED ${m.settlePrice >= 50 ? "YES" : "NO"}` : "PERP";
  const ui = Object.assign(old ?? {}, {
    id: `chain-${m.idx}`,
    chainIdx: m.idx,
    name: m.name,
    group: status,
    title: symbolInfo[m.name]?.title ?? m.name,
    tag: symbolInfo[m.name]?.tag ?? m.name.slice(0, 11),
    price: !m.settled && livePrice[m.name] !== undefined ? livePrice[m.name] : m.mark, // live Gemini price, else oracle mark
    index: m.index, // oracle index, without skew impact (entry price is derived from this)
    move: old?.move ?? 0,
    liquidity: `${fmt(m.longOI + m.shortOI)} MON`,
    expiry: new Date(m.expiry * 1000).toISOString().slice(0, 10),
    volume: symbolInfo[m.name]?.volume ?? "—",
    volumeNum: symbolInfo[m.name]?.volumeNum ?? 0,
    demo: false,
    longOI: m.longOI,
    shortOI: m.shortOI,
    oiCap: m.oiCap,
    skew: m.skew,
    fundingPerDay: m.funding,
    settled: m.settled,
    priceTime: m.priceTime,
  });
  return ui;
}

function syncChainMarkets(list) {
  chainMarkets = list;
  const fresh = list.map(toUiMarket);
  const rest = markets.filter((m) => m.chainIdx === undefined);
  markets.length = 0;
  markets.push(...fresh, ...rest);
  if (active.chainIdx !== undefined) active = markets.find((m) => m.chainIdx === active.chainIdx) ?? NO_MARKET;
  else if (active === NO_MARKET && fresh.length) active = fresh[0];
}

// "Your position" card on the trade screen for the active market.
function paintMyPosition() {
  const el = $("#my-position");
  const ps = active.chainIdx === undefined ? [] : myOpen.filter((p) => p.marketIdx === active.chainIdx);
  el.hidden = !ps.length;
  el.innerHTML = ps.length
    ? `<div>${ps
        .map(
          (p) =>
            `<b>Your position · ${p.isLong ? "LONG YES" : "SHORT NO"}</b><span>${fmt(p.notional)} MON size · ${fmt(p.collateral)} MON margin · entry ${p.entry.toFixed(2)}¢ · P&amp;L ${signed(p.pnl)} MON${p.liquidatable ? " · AT RISK" : ""} · close it under My positions</span>`,
        )
        .join("")}</div>`
    : "";
}

function paintMarketExtras() {
  paintMyPosition();
  const a = active;
  const onChain = a.chainIdx !== undefined;
  $("#funding").textContent = onChain ? `${fmt(a.fundingPerDay * 100, 2)}%` : "—";
  $("#oracle-age").textContent = onChain ? (a.priceTime ? age(a.priceTime) : "no update yet") : "—";
  const listable = !onChain && a.symbol && isOwner() && Chain.enabled();
  $("#list-market").hidden = !listable;
  $("#trade").hidden = !onChain && listable;
  $("#trade").textContent = tradeLabel();
  $("#ticket-state").textContent = onChain
    ? a.settled
      ? "MARKET SETTLED"
      : "LIVE · MON MARGIN"
    : "REFERENCE ONLY";
}

async function onMarketSelected(m) {
  paintMarketExtras();
  if (m?.chainIdx === undefined || !Chain.enabled()) return;
  if (symOf(m)) return; // Gemini candles (main.js) are the history source; no on-chain log scan needed
  try {
    const hist = await Chain.priceHistory(m.chainIdx);
    if (hist.length > 1) {
      m.history = hist.map((h) => h.price);
      m.move = Number(((m.price - m.history[0]) / Math.max(m.history[0], 0.01) * 100).toFixed(2));
    }
    if (active === m) render();
  } catch (error) {
    console.warn("price history unavailable", error);
  }
}

// ── My positions ──
async function renderPositions() {
  const status = $("#positions-status"),
    body = $("#positions-body");
  if (!Chain.enabled()) {
    status.textContent = "No contract configured. Run scripts/deploy.mjs, then reload.";
    body.innerHTML = "";
    return;
  }
  if (!walletAddress) {
    status.textContent = "Connect MetaMask to see your positions.";
    body.innerHTML = "";
    $("#portfolio-kpis").innerHTML = "";
    myOpen = [];
    paintMyPosition();
    return;
  }
  let all, bal;
  try {
    [all, bal] = await Promise.all([Chain.userPositions(walletAddress), Chain.balance(walletAddress)]);
  } catch (error) {
    status.textContent = `Could not load your positions: ${Chain.errorText(error)}`;
    return;
  }
  const mine = all.filter((p) => p.open);
  myOpen = mine;
  buyingPower = bal;
  $("#balance").textContent = `Buying power · ${fmt(bal, 4)} MON`;
  status.textContent = `${short(walletAddress)} · ${mine.length} open, ${all.length - mine.length} closed`;
  const total = mine.reduce((s, p) => s + p.pnl - p.funding, 0);
  const posValue = mine.reduce((s, p) => s + p.equity, 0); // margin + PnL - funding, what closing now would return
  $("#positions-summary").innerHTML = `Unrealized ${signed(total)} MON`;
  const kpi = (label, value, cls = "") => `<div><span>${label}</span><b class="${cls}">${value}</b></div>`;
  $("#portfolio-kpis").innerHTML = [
    kpi("NET WORTH", `${fmt(bal + posValue, 4)} MON`),
    kpi("BUYING POWER", `${fmt(bal, 4)} MON`),
    kpi("POSITIONS", `${fmt(posValue, 4)} MON · ${mine.length} open`),
    kpi("UNREALIZED P&L", `${total >= 0 ? "+" : ""}${fmt(total, 4)} MON`, total >= 0 ? "up" : "down"),
  ].join("");
  body.innerHTML = mine.length
    ? mine
        .map((p) => {
          const m = chainMarkets[p.marketIdx];
          return `<tr class="pos-row" data-open-market="${p.marketIdx}" title="Open this market">
            <td>${marketName(p.marketIdx)}</td>
            <td><b class="${p.isLong ? "up" : "down"}">${p.isLong ? "LONG YES" : "SHORT NO"}</b></td>
            <td>${fmt(p.notional)}</td><td>${fmt(p.collateral)}</td>
            <td>${p.entry.toFixed(2)}¢</td><td>${m ? m.mark.toFixed(2) : "—"}¢</td>
            <td>${signed(p.pnl)}</td><td>${fmt(-p.funding)}</td>
            <td>${p.liquidatable ? '<b class="down">AT RISK</b>' : "ok"}</td>
            <td><button data-close="${p.id}">Close</button></td></tr>`;
        })
        .join("")
    : `<tr><td colspan="10">No open positions. Pick a market and open one.</td></tr>`;
  // Click a row (not its Close button) to jump to that market's trade screen.
  $$("[data-open-market]").forEach((row) => {
    row.onclick = (e) => {
      if (e.target.closest("button")) return;
      const m = markets.find((x) => x.chainIdx === Number(row.dataset.openMarket));
      if (!m) return;
      active = m;
      render();
      showScreen("trade");
      onMarketSelected(active);
    };
  });
  paintMyPosition();
}

// ── House dashboard ──
async function renderHouse() {
  if (!Chain.enabled()) {
    $("#house-status").textContent = "No contract configured. Run scripts/deploy.mjs, then reload.";
    return;
  }
  let h, positions, feed;
  try {
    [h, positions, feed] = await Promise.all([Chain.house(), Chain.allPositions(), Chain.feed()]);
  } catch (error) {
    $("#house-status").textContent = `Could not load house data: ${Chain.errorText(error)}`;
    return;
  }
  houseInfo = h;
  const open = positions.filter((p) => p.open);
  const stale = chainMarkets.filter((m) => !m.settled && m.priceTime && Date.now() / 1000 - m.priceTime > h.maxStale);
  $("#house-status").textContent = isOwner()
    ? `Owner wallet ${short(walletAddress)} · ${chainMarkets.length} markets · ${open.length} open positions`
    : `Read-only view${walletAddress ? "" : " · connect the owner wallet to deposit/withdraw"}. Contract ${short(Chain.config().address)}`;
  $("#house-updated").textContent = `updated ${new Date().toLocaleTimeString()}`;
  const kpi = (label, value, cls = "") => `<div><span>${label}</span><b class="${cls}">${value}</b></div>`;
  const traderPnl = open.reduce((s, p) => s + p.pnl, 0);
  $("#house-kpis").innerHTML = [
    kpi("VAULT BALANCE", `${fmt(h.houseBalance)} MON`),
    kpi("RESERVED (MAX PAYOUT)", `${fmt(h.reserved)} MON`),
    kpi("FREE LIQUIDITY", `${fmt(h.free)} MON`, h.free < h.houseBalance * 0.1 ? "down" : ""),
    kpi("REALIZED HOUSE P&L", `${h.realizedPnl >= 0 ? "+" : ""}${fmt(h.realizedPnl)} MON`, h.realizedPnl >= 0 ? "up" : "down"),
    kpi("UNREALIZED (TRADERS' PNL)", `${fmt(traderPnl)} MON`),
    kpi("ORACLE", `${h.quorum}/${h.signerCount} signers${stale.length ? ` · ${stale.length} STALE` : ""}`, stale.length ? "down" : ""),
    kpi("FEE / MAINT / MAX LEV", `${h.feeBps / 100}% · ${h.maintBps / 100}% · ${h.maxLeverage}×`),
  ].join("");

  $("#house-markets").innerHTML = chainMarkets.length
    ? chainMarkets
        .map((m) => {
          const ps = open.filter((p) => p.marketIdx === m.idx);
          const ifYes = -ps.reduce((s, p) => s + payoffAt(p, 100), 0);
          const ifNo = -ps.reduce((s, p) => s + payoffAt(p, 0), 0);
          const net = m.longOI - m.shortOI;
          return `<tr><td>${escapeHTML(symbolInfo[m.name]?.title ?? m.name)}${m.settled ? " (settled)" : ""}</td>
            <td>${m.mark.toFixed(2)}¢</td><td>${fmt(m.longOI)}</td><td>${fmt(m.shortOI)}</td>
            <td>${net === 0 ? "flat" : net > 0 ? `short ${fmt(net)}` : `long ${fmt(-net)}`}</td>
            <td>${signed(ifYes)}</td><td>${signed(ifNo)}</td>
            <td>${m.priceTime ? age(m.priceTime) : "never"}</td></tr>`;
        })
        .join("")
    : `<tr><td colspan="8">No markets listed yet.</td></tr>`;

  $("#house-positions").innerHTML = open.length
    ? open
        .map(
          (p) => `<tr><td>${p.id}</td><td>${short(p.trader)}</td><td>${marketName(p.marketIdx)}</td>
          <td><b class="${p.isLong ? "up" : "down"}">${p.isLong ? "LONG" : "SHORT"}</b></td>
          <td>${fmt(p.notional)}</td><td>${p.entry.toFixed(2)}¢</td>
          <td>${signed(p.pnl)}</td><td>${signed(-p.pnl)}</td>
          <td>${p.liquidatable ? '<b class="down">LIQUIDATABLE</b>' : `eq ${fmt(p.equity)}`}</td>
          <td>${p.liquidatable ? `<button data-liquidate="${p.id}">Liquidate</button>` : ""}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="10">No open positions.</td></tr>`;

  $("#house-feed").innerHTML = feed.length
    ? feed
        .map((f) => {
          const detail =
            f.kind === "open"
              ? `${f.isLong ? "LONG" : "SHORT"} ${fmt(ethers.formatEther(f.notional))} @ ${(Number(f.entryPrice) / 1e16).toFixed(2)}¢`
              : `${["closed", "LIQUIDATED", "settled"][Number(f.reason)]} · payout ${fmt(ethers.formatEther(f.payout))} · house ${fmt(ethers.formatEther(f.houseDelta))}`;
          return `<tr><td>${f.block}</td><td>${f.kind === "open" ? "OPEN" : "CLOSE"}</td><td>${f.id}</td>
            <td>${short(f.trader)}</td><td>${marketName(Number(f.marketId))}</td><td>${detail}</td></tr>`;
        })
        .join("")
    : `<tr><td colspan="6">No trades in the last 50k blocks.</td></tr>`;
  $("#house-nav").hidden = !isOwner();
}

// ── refresh loop ──
async function refreshAll() {
  if (refreshing || !Chain.enabled()) return;
  refreshing = true;
  try {
    syncChainMarkets(await Chain.loadMarkets());
    if (!houseInfo) houseInfo = await Chain.house();
    render();
    paintMarketExtras();
    const screen = window.location.hash.slice(1);
    if (screen === "positions" || walletAddress) await renderPositions();
    if (screen === "house") await renderHouse();
    else $("#house-nav").hidden = !isOwner();
  } catch (error) {
    console.error("refresh failed", error);
    const msg = `Could not reach the chain: ${Chain.errorText(error)}`;
    $("#notice").textContent = msg;
    $("#positions-status").textContent = msg;
  } finally {
    refreshing = false;
  }
}
function onWalletChange() {
  refreshAll();
}

// ── actions ──
const report = (el, text) => ($(el).textContent = text);
async function act(el, work, doneText) {
  try {
    report(el, "Confirm in MetaMask…");
    await work();
    report(el, doneText);
    await refreshAll();
  } catch (error) {
    report(el, Chain.errorText(error));
  }
}
document.addEventListener("click", (event) => {
  const t = event.target;
  if (!(t instanceof HTMLElement)) return;
  if (!connected && (t.dataset.close || t.dataset.liquidate))
    return report(t.dataset.close ? "#positions-notice" : "#house-notice", "Connect MetaMask first.");
  if (t.dataset.close) act("#positions-notice", () => Chain.close(walletProvider, Number(t.dataset.close)), "Position closed.");
  if (t.dataset.liquidate) act("#house-notice", () => Chain.liquidate(walletProvider, Number(t.dataset.liquidate)), "Liquidated.");
});
$("#house-deposit").onclick = () => {
  if (!connected) return report("#house-notice", "Connect the owner wallet.");
  if (!isOwner()) return report("#house-notice", "Only the contract owner can deposit.");
  if (!(Number($("#house-amount").value) > 0)) return report("#house-notice", "Enter an amount in MON.");
  act("#house-notice", () => Chain.deposit(walletProvider, Number($("#house-amount").value)), "Deposited.");
};
$("#house-withdraw").onclick = () => {
  if (!connected) return report("#house-notice", "Connect the owner wallet.");
  if (!(Number($("#house-amount").value) > 0)) return report("#house-notice", "Enter an amount in MON.");
  if (!isOwner()) return report("#house-notice", "Only the contract owner can withdraw.");
  act("#house-notice", () => Chain.withdraw(walletProvider, Number($("#house-amount").value)), "Withdrawn.");
};
// Owner lists a Gemini contract as a perp. Defaults are deliberately conservative: 5c skew, 10%/day funding at full skew.
$("#list-market").onclick = () => {
  const expiry = Math.floor(Date.parse(active.expiryISO) / 1000);
  if (!expiry) return report("#notice", "This contract has no parseable expiry.");
  const price = Math.min(95, Math.max(5, active.price)) / 100;
  act(
    "#notice",
    () => Chain.createMarket(walletProvider, { name: active.symbol, expiry, price, oiCap: 500, skew: 0.05, funding: 0.1 }),
    "Listed. The oracle keeper quotes it automatically (market name = Gemini symbol).",
  );
};
document.addEventListener("click", (e) => {
  if (e.target instanceof HTMLElement && e.target.closest("[data-screen], [data-screen-target]")) setTimeout(refreshAll, 0);
});

if (Chain.enabled()) {
  refreshAll();
  setInterval(() => !document.hidden && refreshAll(), 15000);
} else {
  $("#ticket-state").textContent = "NO CONTRACT CONFIGURED";
}
