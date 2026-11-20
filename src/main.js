// Tradable perps are loaded from the contract (see perps.js); Gemini rows are reference listings.
const markets = [];
const NO_MARKET = {
  id: "none",
  group: "—",
  title: "No market selected",
  tag: "—",
  price: 50,
  move: 0,
  liquidity: "—",
  expiry: "—",
  volume: "—",
  demo: false,
};
const MONAD_TESTNET = {
  chainId: "0x279f",
  chainName: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: ["https://testnet-rpc.monad.xyz"],
};
// The wallet network follows the deployment (Monad testnet, or a local chain while developing).
const NETWORK = window.PERPS_CONFIG
  ? {
      chainId: "0x" + Number(window.PERPS_CONFIG.chainId).toString(16),
      chainName:
        Number(window.PERPS_CONFIG.chainId) === 10143
          ? "Monad Testnet"
          : "Local chain",
      nativeCurrency: MONAD_TESTNET.nativeCurrency,
      rpcUrls: [window.PERPS_CONFIG.rpcUrl],
    }
  : MONAD_TESTNET;
let active = NO_MARKET,
  side = "long",
  connected = false,
  walletProvider = null,
  walletAddress = "",
  walletChainId = "",
  chartRange = "1D",
  chartType = "line",
  marketCategory = "All",
  marketSearch = "",
  visibleMarketCount = 15,
  feedOffset = 0,
  feedTotal = Infinity,
  feedLoading = false,
  feedError = false;
const initialMarketCount = markets.length;
const symbolInfo = {}; // Gemini symbol -> imported market (title, tag, volume) for naming on-chain markets
// Seed from the shipped name list so on-chain markets have titles before any Gemini request returns.
for (const [symbol, title] of Object.entries(window.MARKET_NAMES ?? {}))
  symbolInfo[symbol] = { title, tag: symbol.slice(symbol.lastIndexOf("-") + 1).slice(0, 11) };
const livePrice = {}; // Gemini symbol -> live YES price in cents, polled straight from Gemini
let shownMarkets = []; // cards currently on the Markets grid (polled for live prices)
const symOf = (m) => m.symbol ?? (m.chainIdx !== undefined ? m.name : undefined);
const chartSamples = { "1D": 24, "1W": 40, "1M": 54, ALL: 64 };
const feedPageSize = 100;
const marketPageSize = 15; // 5 rows of the 3-column grid
const chartLabels = {
  "1D": ["00:00", "06:00", "12:00", "18:00", "NOW"],
  "1W": ["-7D", "-5D", "-3D", "-1D", "NOW"],
  "1M": ["-30D", "-21D", "-14D", "-7D", "NOW"],
  ALL: ["START", "", "", "", "NOW"],
};
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
function showScreen(name, updateHistory = true) {
  const validScreens = ["overview", "markets", "trade", "positions", "house"];
  const screenName = validScreens.includes(name) ? name : "overview";
  $$(".app-screen").forEach((screen) => {
    screen.hidden = screen.id !== `${screenName}-screen`;
  });
  $$("nav [data-screen]").forEach((link) =>
    link.classList.toggle("selected", link.dataset.screen === screenName),
  );
  if (updateHistory && window.location.hash !== `#${screenName}`) {
    window.history.pushState(null, "", `#${screenName}`);
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function tradeLabel() {
  if (!connected) return "Connect MetaMask to trade";
  if (active.chainIdx === undefined) return "Not listed on-chain";
  return `${side === "long" ? "Long YES" : "Short NO"} · ${$("#leverage").value}×`;
}
function refreshWalletUI() {
  const label = connected
    ? walletAddress.slice(0, 6) + "..." + walletAddress.slice(-4)
    : walletAddress
      ? "Switch network"
      : "Connect MetaMask";
  $("#wallet span").textContent = label;
  $("#netname").textContent = NETWORK.chainName;
  $("#trade").textContent = tradeLabel();
  if (typeof onWalletChange === "function") onWalletChange();
}
function getMetaMaskProvider() {
  const injected = window.ethereum,
    providers = Array.isArray(injected?.providers)
      ? injected.providers
      : injected
        ? [injected]
        : [],
    provider = providers.find((candidate) => candidate.isMetaMask);
  if (!provider)
    throw Error(
      "MetaMask was not detected. Install the MetaMask extension, then reload this page.",
    );
  return provider;
}
function handleWalletEvent(provider, event, callback) {
  if (typeof provider.on === "function") provider.on(event, callback);
}
async function switchToMonadTestnet(provider) {
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: NETWORK.chainId }],
    });
  } catch (error) {
    if (error?.code !== 4902) throw error;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [NETWORK],
    });
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: NETWORK.chainId }],
    });
  }
  const chainId = await provider.request({ method: "eth_chainId" });
  if (
    typeof chainId !== "string" ||
    chainId.toLowerCase() !== NETWORK.chainId
  ) {
    throw Error(`MetaMask must be connected to ${NETWORK.chainName}.`);
  }
  return chainId.toLowerCase();
}
function registerWalletEvents(provider) {
  if (walletProvider === provider) return;
  walletProvider = provider;
  handleWalletEvent(provider, "accountsChanged", (accounts) => {
    walletAddress = Array.isArray(accounts) ? (accounts[0] ?? "") : "";
    connected =
      Boolean(walletAddress) && walletChainId === NETWORK.chainId;
    refreshWalletUI();
    $("#notice").textContent = connected
      ? "MetaMask account updated."
      : walletAddress
        ? `Switch MetaMask to ${NETWORK.chainName}.`
        : "MetaMask disconnected.";
  });
  handleWalletEvent(provider, "chainChanged", (chainId) => {
    walletChainId = String(chainId).toLowerCase();
    connected =
      Boolean(walletAddress) && walletChainId === NETWORK.chainId;
    refreshWalletUI();
    $("#notice").textContent = connected
      ? `Connected to ${NETWORK.chainName}.`
      : `Switch MetaMask to ${NETWORK.chainName} to trade.`;
  });
}
function escapeHTML(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );
}
function createHistory(market) {
  if (!market.demo) return Array(64).fill(market.price);
  let price = market.price;
  return Array.from({ length: 64 }, (_, index) => {
    if (index === 63) return market.price;
    price = Math.max(1, Math.min(99, price + (Math.random() - 0.5) * 1.4));
    return price;
  });
}
function renderChart() {
  if (!active.history) active.history = createHistory(active);
  const values = active.liveHist ? active.history : active.history.slice(-chartSamples[chartRange]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || 1;
  const points = values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * 880;
    const y = 225 - ((value - min) / spread) * 180;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = `M${points.join(" L")}`;
  const chartLine = $("#chart-line");
  const chartArea = $("#chart-area");
  const candles = $("#chart-candles");
  if (chartType === "line") {
    chartLine.style.display = "";
    chartArea.style.display = "";
    candles.innerHTML = "";
    chartLine.setAttribute("d", line);
    chartArea.setAttribute("d", `${line} L880,250 L0,250 Z`);
  } else {
    chartLine.style.display = "none";
    chartArea.style.display = "none";
    const barSize = Math.max(2, Math.ceil(values.length / 24));
    const bars = [];
    for (let index = 0; index < values.length; index += barSize) {
      const sample = values.slice(index, index + barSize);
      if (sample.length < 2) continue;
      const open = sample[0];
      const close = sample[sample.length - 1];
      const high = Math.max(...sample);
      const low = Math.min(...sample);
      const x = ((index + sample.length / 2) / values.length) * 880;
      const yOpen = 225 - ((open - min) / spread) * 180;
      const yClose = 225 - ((close - min) / spread) * 180;
      const yHigh = 225 - ((high - min) / spread) * 180;
      const yLow = 225 - ((low - min) / spread) * 180;
      const width = Math.max(3, 880 / Math.ceil(values.length / barSize) / 2);
      bars.push(
        `<g class="candle ${close >= open ? "up" : "down"}"><line x1="${x.toFixed(1)}" y1="${yHigh.toFixed(1)}" x2="${x.toFixed(1)}" y2="${yLow.toFixed(1)}" stroke="currentColor" stroke-width="1"/><rect x="${(x - width / 2).toFixed(1)}" y="${Math.min(yOpen, yClose).toFixed(1)}" width="${width.toFixed(1)}" height="${Math.max(2, Math.abs(yClose - yOpen)).toFixed(1)}" fill="currentColor"/></g>`,
      );
    }
    candles.innerHTML = bars.join("");
  }
  $$(".chart-labels span").forEach((label, index) => {
    label.textContent = chartLabels[chartRange][index];
  });
}
// Gemini reference rows disappear once the same contract is listed as a perp.
const listedSymbols = () =>
  new Set(markets.filter((m) => m.chainIdx !== undefined).map((m) => m.name));
function renderMarkets() {
  $("#ticks").innerHTML = markets
    .slice(0, 8)
    .map(
      (m) =>
        `<button class="${m.id === active.id ? "tick active" : "tick"}" data-market="${m.id}">${escapeHTML(m.tag)} <strong class="${m.move >= 0 ? "up" : "down"}">${m.move >= 0 ? "+" : ""}${m.move}%</strong></button>`,
    )
    .join("");
  const categories = [
    "All",
    ...new Set(markets.map((market) => market.group).filter(Boolean)),
  ];
  $("#market-filters").innerHTML = categories
    .map(
      (category) =>
        `<button class="${category === marketCategory ? "filter-active" : ""}" data-category="${escapeHTML(category)}">${escapeHTML(category)}</button>`,
    )
    .join("");
  const visibleMarkets = markets.filter((market) => {
    const matchesCategory =
      marketCategory === "All" || market.group === marketCategory;
    if (market.symbol && listedSymbols().has(market.symbol)) return false;
    const query = marketSearch.toLowerCase();
    const matchesQuery =
      !query ||
      `${market.title} ${market.group} ${market.tag}`
        .toLowerCase()
        .includes(query);
    return matchesCategory && matchesQuery;
  });
  // Tradable on-chain perps first, then relevance: 24h volume, then the most contested price (closest to 50¢).
  visibleMarkets.sort(
    (a, b) =>
      (b.chainIdx !== undefined) - (a.chainIdx !== undefined) ||
      (b.volumeNum ?? 0) - (a.volumeNum ?? 0) ||
      Math.abs(a.price - 50) - Math.abs(b.price - 50),
  );
  const page = visibleMarkets.slice(0, visibleMarketCount);
  shownMarkets = page;
  $("#market-grid").innerHTML = page.length
    ? page
        .map(
          (market) =>
            `<button class="market-card${market.id === active.id ? " selected-market" : ""}" data-market="${escapeHTML(market.id)}" aria-pressed="${market.id === active.id}"><div><span>${escapeHTML(market.group.toUpperCase())}</span><b class="${market.move >= 0 ? "up" : "down"}">${market.move >= 0 ? "+" : ""}${market.move}%</b></div><h3>${escapeHTML(market.title)}</h3><div class="card-price"><strong>${market.price.toFixed(1)}¢</strong><span>YES price</span></div><div class="card-foot"><span>24H ${escapeHTML(market.volume)}</span><span>◷ ${escapeHTML(market.expiry)}</span></div></button>`,
        )
        .join("")
    : '<div class="empty-state">No markets match this search.</div>';
  $$("[data-market]").forEach(
    (b) =>
      (b.onclick = () => {
        active = markets.find((m) => m.id === b.dataset.market);
        render();
        showScreen("trade");
        if (typeof onMarketSelected === "function") onMarketSelected(active);
      }),
  );
  $$(".market-filters [data-category]").forEach(
    (button) =>
      (button.onclick = () => {
        marketCategory = button.dataset.category;
        visibleMarketCount = marketPageSize;
        renderMarkets();
      }),
  );
  $("#market-count").textContent = String(markets.length).padStart(2, "0");
  $("#overview-title").textContent = active.title;
  $("#overview-price").textContent = `${active.price.toFixed(1)}¢`;
  $("#feed-count").textContent =
    `${markets.length - initialMarketCount} imported · ${feedOffset}/${Number.isFinite(feedTotal) ? feedTotal : "—"} events`;
  $("#market-results-count").textContent =
    `Showing ${Math.min(visibleMarketCount, visibleMarkets.length)} of ${visibleMarkets.length} matching markets · ${markets.length - initialMarketCount} imported`;
  $("#show-more-markets").hidden = visibleMarketCount >= visibleMarkets.length;
  $("#show-more-markets").disabled = feedLoading;
  $("#load-more-markets").hidden = feedOffset >= feedTotal && !feedError;
  $("#load-more-markets").disabled = feedLoading;
  $("#load-more-markets").textContent = feedLoading
    ? "Importing…"
    : feedError
      ? "Retry import"
      : "Import next batch";
}
// Mirrors PredictionPerps: entry = index + skew × (net OI after trade) / cap;
// liquidation when equity falls to the 1% maintenance margin (funding ignored).
const FEE = 0.0005,
  MAINT = 0.01,
  SLIPPAGE_CENTS = 0.5;
function entryPrice(market, isLong, notional) {
  if (!market.oiCap) return market.price;
  const net = market.longOI - market.shortOI + (isLong ? notional : -notional);
  const impact = (market.skew * 100 * net) / market.oiCap;
  // the contract adds impact to the oracle index, not to the current mark (which already has impact)
  return Math.min(99.99, Math.max(0.01, (market.index ?? market.price) + impact));
}
function liquidationPrice(entry, isLong, lev) {
  const e = entry / 100,
    buffer = Math.max(0, 1 / lev - MAINT);
  const price = isLong ? e * (1 - buffer) : e + (1 - e) * buffer;
  return Math.min(100, Math.max(0, price * 100));
}
function estimate() {
  const amount = Number($("#amount").value) || 0,
    lev = Number($("#leverage").value),
    notional = amount * lev,
    isLong = side === "long",
    entry = entryPrice(active, isLong, notional);
  $("#lev-value").textContent = lev + "×";
  $("#notional").textContent =
    notional.toLocaleString(undefined, { maximumFractionDigits: 2 }) + " MON";
  $("#entry").textContent = entry.toFixed(2) + "¢";
  $("#liq").textContent = liquidationPrice(entry, isLong, lev).toFixed(1) + "¢";
  $("#fee").textContent = (notional * FEE).toFixed(4) + " MON";
  $$(".lever-pills button").forEach((b) =>
    b.classList.toggle("chosen", b.textContent === lev + "×"),
  );
}
function render() {
  $("#tag").textContent = `${active.group.toUpperCase()}  •  ${active.expiry}`;
  $("#title").textContent = active.title;
  $("#price").textContent = active.price.toFixed(1) + "¢";
  $("#overview-title").textContent = active.title;
  $("#overview-price").textContent = `${active.price.toFixed(1)}¢`;
  const move = $("#move");
  move.className = active.move >= 0 ? "up" : "down";
  move.textContent = `${active.move >= 0 ? "↗ +" : "↘ "}${active.move}% 24h`;
  $("#volume").textContent = active.volume;
  $("#liquidity").textContent = active.liquidity;
  renderChart();
  renderMarkets();
  estimate();
}
$("#wallet").onclick = async () => {
  try {
    const provider = getMetaMaskProvider();
    walletChainId = await switchToMonadTestnet(provider);
    const accounts = await provider.request({
      method: "eth_requestAccounts",
    });
    const account = Array.isArray(accounts) ? accounts[0] : "";
    if (typeof account !== "string" || !account) {
      throw Error("MetaMask did not return an account.");
    }
    walletAddress = account;
    connected = true;
    registerWalletEvents(provider);
    refreshWalletUI();
    try {
      localStorage.setItem("perps.wallet", "1"); // remember the session so a reload reconnects silently
    } catch {}
    $("#notice").textContent = `MetaMask connected to ${NETWORK.chainName}.`;
  } catch (error) {
    $("#notice").textContent =
      error instanceof Error ? error.message : "MetaMask connection failed.";
  }
};
// After a reload, silently restore the session (eth_accounts shows no prompt) if the user connected before.
async function restoreWallet() {
  try {
    if (localStorage.getItem("perps.wallet") !== "1") return;
    const provider = getMetaMaskProvider();
    const [accounts, chainId] = await Promise.all([
      provider.request({ method: "eth_accounts" }),
      provider.request({ method: "eth_chainId" }),
    ]);
    if (!accounts?.[0]) return;
    walletAddress = accounts[0];
    walletChainId = String(chainId).toLowerCase();
    connected = walletChainId === NETWORK.chainId;
    registerWalletEvents(provider);
    refreshWalletUI();
  } catch {} // no MetaMask / no storage: stay disconnected
}
$(".network").onclick = () => $("#wallet").onclick();
$("#menu").onclick = () => $("nav").classList.toggle("open");
$$("[data-screen], [data-screen-target]").forEach((link) => {
  link.onclick = (event) => {
    event.preventDefault();
    showScreen(link.dataset.screen || link.dataset.screenTarget);
    $("nav").classList.remove("open");
  };
});
window.addEventListener("popstate", () => {
  showScreen(window.location.hash.slice(1), false);
});
$("#show-more-markets").onclick = () => {
  visibleMarketCount += marketPageSize;
  renderMarkets();
};
$("#load-more-markets").onclick = loadGeminiMarkets;
$$("[data-range]").forEach((button) => {
  button.onclick = () => {
    chartRange = button.dataset.range;
    $$(".chart-controls [data-range]").forEach((item) =>
      item.classList.toggle("active-range", item === button),
    );
    renderChart();
  };
});
$$("[data-chart]").forEach((button) => {
  button.onclick = () => {
    chartType = button.dataset.chart;
    $$("[data-chart]").forEach((item) =>
      item.classList.toggle("chart-type-active", item === button),
    );
    renderChart();
  };
});
$("#market-search").oninput = (event) => {
  marketSearch = event.target.value.trim();
  visibleMarketCount = marketPageSize;
  renderMarkets();
};
$$(".tabs button").forEach(
  (b) =>
    (b.onclick = () => {
      side = b.dataset.side;
      $$(".tabs button").forEach((x) =>
        x.classList.toggle("tab-active", x === b),
      );
      $("#trade").className = "trade-button " + side;
      $("#trade").textContent = tradeLabel();
      estimate();
    }),
);
$$("[data-amount]").forEach(
  (b) =>
    (b.onclick = () => {
      $("#amount").value = b.dataset.amount;
      estimate();
    }),
);
$("#amount").oninput = () => {
  $("#amount").value = $("#amount").value.replace(/[^0-9.]/g, "");
  estimate();
};
$("#leverage").oninput = () => {
  estimate();
  $("#trade").textContent = tradeLabel();
};
$$(".lever-pills button").forEach(
  (b) =>
    (b.onclick = () => {
      $("#leverage").value = b.textContent.replace("×", "");
      $("#leverage").oninput();
    }),
);
const walletOnNetwork = () => walletChainId === NETWORK.chainId;
$("#trade").onclick = async () => {
  const notice = (text) => ($("#notice").textContent = text);
  if (!connected) return $("#wallet").onclick();
  if (active.chainIdx === undefined)
    return notice("This market is not listed on-chain yet.");
  const amount = Number($("#amount").value);
  if (active.settled) return notice("This market has settled; it no longer accepts trades.");
  if (!walletOnNetwork()) return notice(`Switch MetaMask to ${NETWORK.chainName}.`);
  if (!(amount > 0)) return notice("Enter a collateral amount.");
  if (typeof buyingPower === "number" && amount > buyingPower)
    return notice(`Not enough MON: you have ${buyingPower.toFixed(4)}, this trade needs ${amount}.`);
  try {
    // The contract reverts with "house capacity" when the most this trade can win exceeds the house's free liquidity.
    const notional = amount * Number($("#leverage").value);
    const e = entryPrice(active, side === "long", notional) / 100;
    const win = side === "long" ? (notional * (1 - e)) / e : (notional * e) / (1 - e);
    const { free } = await Chain.house();
    if (win > free)
      return notice(
        `House capacity: this could win up to ${win.toFixed(2)} MON but the house has ${free.toFixed(2)} MON free. ` +
          `Max size here is about ${((notional * free) / win).toFixed(2)} MON (lower the collateral or leverage), or the owner can deposit more on the House screen.`,
      );
  } catch {} // can't read the house: let the contract decide
  try {
    $("#trade").disabled = true;
    notice("Confirm the transaction in MetaMask…");
    const hash = await Chain.open(
      walletProvider,
      active.chainIdx,
      side === "long",
      Number($("#leverage").value),
      amount,
      // 0.5¢ slippage tolerance around the entry shown in the ticket
      Math.min(
        100,
        Math.max(
          0,
          entryPrice(active, side === "long", amount * Number($("#leverage").value)) +
            (side === "long" ? SLIPPAGE_CENTS : -SLIPPAGE_CENTS),
        ),
      ),
    );
    notice(`Position opened · tx ${hash.slice(0, 10)}…`);
    if (typeof refreshAll === "function") refreshAll();
  } catch (error) {
    notice(Chain.errorText(error));
  } finally {
    $("#trade").disabled = false;
  }
};
async function loadGeminiMarkets() {
  if (feedLoading || (feedOffset >= feedTotal && !feedError)) return;
  feedLoading = true;
  feedError = false;
  $("#feed-status").textContent = "FETCHING GEMINI MARKETS…";
  renderMarkets();
  try {
    const response = await fetch(
      `https://api.gemini.com/v1/prediction-markets/events?limit=${feedPageSize}&offset=${feedOffset}`,
      { signal: AbortSignal.timeout(30000) }, // ~3 MB per page; slow links need >10 s. Still bounded so "Importing…" can't stick.
    );
    if (!response.ok) {
      throw Error(`Gemini feed returned HTTP ${response.status}.`);
    }
    const payload = await response.json();
    const events = Array.isArray(payload.data)
      ? payload.data
      : Array.isArray(payload.events)
        ? payload.events
        : [];
    if (!events.length) {
      feedTotal = feedOffset;
      return;
    }
    const nextOffset = feedOffset + events.length;
    const reportedTotal = Number(payload.pagination?.total ?? nextOffset);
    feedTotal = Number.isFinite(reportedTotal) ? reportedTotal : nextOffset;
    feedOffset = nextOffset;
    const existingIds = new Set(markets.map((market) => market.id));
    const imported = events
      .filter((event) => event.status === "active")
      .flatMap((event) =>
        (Array.isArray(event.contracts) ? event.contracts : [])
          .filter(
            (contract) =>
              contract.status === "active" && contract.marketState === "open",
          )
          .map((contract) => {
            const yesPrice = Number(
              contract.prices?.lastTradePrice ?? contract.prices?.buy?.yes,
            );
            const volume = Number(event.volume24h ?? event.volume);
            return {
              id: `gemini-${contract.id}`,
              symbol: contract.instrumentSymbol,
              expiryISO: contract.expiryDate || event.expiryDate || "",
              group: event.category || "Other",
              title: `${event.title || "Prediction market"} · ${contract.label || contract.ticker || ""}`,
              tag: (contract.ticker || event.ticker || "GEMINI").slice(0, 11),
              price: yesPrice * 100,
              move: 0,
              liquidity: "—",
              expiry: (contract.expiryDate || event.expiryDate || "Open").slice(
                0,
                10,
              ),
              volume: Number.isFinite(volume)
                ? new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                    notation: "compact",
                    maximumFractionDigits: 1,
                  }).format(volume)
                : "—",
              volumeNum: Number.isFinite(volume) ? volume : 0,
              demo: false,
            };
          }),
      )
      .filter(
        (market) =>
          Number.isFinite(market.price) &&
          market.price > 0 &&
          market.price <= 100 &&
          !existingIds.has(market.id),
      );
    markets.push(...imported);
    // The contract only stores the Gemini symbol; remember the human title so on-chain markets can show it.
    for (const m of imported) symbolInfo[m.symbol] = m;
    for (const m of markets) {
      const info = m.chainIdx !== undefined && symbolInfo[m.name];
      if (info) Object.assign(m, { title: info.title, tag: info.tag, volume: info.volume, volumeNum: info.volumeNum });
    }
    visibleMarketCount += marketPageSize;
    $("#feed-status").textContent =
      `GEMINI PUBLIC DATA · ${markets.length - initialMarketCount} OPEN CONTRACTS`;
  } catch (error) {
    feedError = true;
    $("#feed-status").textContent =
      error instanceof Error
        ? `GEMINI FEED UNAVAILABLE · ${error.message}`
        : "GEMINI FEED UNAVAILABLE · RETRY BELOW";
    console.error("Could not import Gemini markets.", error);
  } finally {
    feedLoading = false;
    render();
  }
}
// Live display prices: Gemini's per-event endpoint is light (≈30 KB) and allows browser calls. Same mid-or-last rule
// as the keeper. This is display only; trades fill at the on-chain oracle index.
// Price history: Gemini's /v2/candles also serves GEMI- prediction contracts (undocumented for them; covers ~the last
// 22h at most). Candles are newest-first, [ms, open, high, low, close, volume].
async function loadGeminiHistory(m) {
  m.histLoaded = true; // set first so the 1s poll doesn't refetch while this is in flight
  try {
    const r = await fetch(`https://api.gemini.com/v2/candles/${symOf(m)}/15m`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw Error(`HTTP ${r.status}`);
    const closes = (await r.json()).map((c) => c[4] * 100).reverse();
    if (closes.length < 2) return;
    m.history = closes;
    m.liveHist = true;
    m.move = Number((((m.price - closes[0]) / Math.max(closes[0], 0.01)) * 100).toFixed(2));
    if (active === m) render();
  } catch {
    m.histLoaded = false; // retry on the next poll
  }
}
let polling = false;
async function pollLive() {
  if (document.hidden || polling) return; // skip while the previous poll is still in flight
  polling = true;
  try {
    await pollLiveOnce();
  } finally {
    polling = false;
  }
}
async function pollLiveOnce() {
  if (symOf(active) && !active.histLoaded) loadGeminiHistory(active);
  const tickers = [...new Set([active, ...shownMarkets].map(symOf).filter(Boolean).map((s) => s.slice(5, s.lastIndexOf("-"))))].slice(0, 12);
  await Promise.all(
    tickers.map(async (t) => {
      try {
        const r = await fetch(`https://api.gemini.com/v1/prediction-markets/events/${t}`, { signal: AbortSignal.timeout(8000) });
        if (!r.ok) return;
        const ev = await r.json();
        for (const c of ev.contracts ?? []) {
          // Titles normally come from the bulk feed; this small per-event fetch fills them in when that feed fails.
          symbolInfo[c.instrumentSymbol] ??= {
            title: `${ev.title || "Prediction market"} · ${c.label || c.ticker || ""}`,
            tag: (c.ticker || ev.ticker || "GEMINI").slice(0, 11),
          };
          if (c.resolutionSide) continue;
          const { bestBid, bestAsk, lastTradePrice } = c.prices ?? {};
          const bid = Number(bestBid), ask = Number(bestAsk);
          const p = (bid > 0 && ask > 0 && ask - bid <= 0.1 ? (bid + ask) / 2 : Number(lastTradePrice)) * 100;
          if (p > 0 && p < 100) livePrice[c.instrumentSymbol] = p;
        }
      } catch {} // next tick retries
    }),
  );
  for (const m of markets) {
    if (!m.settled && livePrice[symOf(m)] !== undefined) m.price = livePrice[symOf(m)];
    const info = m.chainIdx !== undefined && m.title === m.name && symbolInfo[m.name];
    if (info) Object.assign(m, { title: info.title, tag: info.tag });
  }
  if (active.liveHist) active.history[active.history.length - 1] = active.price; // chart tip follows the live price
  render();
}
setInterval(pollLive, 1000);
setTimeout(pollLive, 1500);
setInterval(() => {
  if (!active.demo) return;
  const delta = (Math.random() - 0.46) * 0.18;
  active.price = Math.max(1, Math.min(99, active.price + delta));
  active.move = Number((active.move + delta).toFixed(2));
  if (!active.history) active.history = createHistory(active);
  active.history.push(active.price);
  if (active.history.length > 64) active.history.shift();
  $("#index-move").textContent =
    (active.move >= 0 ? "+" : "") + active.move.toFixed(2) + "%";
  render();
}, 1800);
const initialScreen = window.location.hash.slice(1);
showScreen(initialScreen || "overview", false);
render();
$("#netname").textContent = NETWORK.chainName;
loadGeminiMarkets();
restoreWallet();
