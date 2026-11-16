import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

class Element {
  constructor(id = "") {
    this.id = id;
    this.hidden = false;
    this.disabled = false;
    this.textContent = "";
    this.innerHTML = "";
    this.value = id === "amount" ? "250" : id === "leverage" ? "3" : "";
    this.dataset = {};
    this.className = "";
    this.attributes = {};
    this.style = {};
    this.listeners = {};
    this.classList = {
      add: (...names) =>
        this.setClasses([...new Set([...this.classes(), ...names])]),
      remove: (...names) =>
        this.setClasses(this.classes().filter((name) => !names.includes(name))),
      contains: (name) => this.classes().includes(name),
      toggle: (name, force) => {
        const enabled = force ?? !this.classList.contains(name);
        if (enabled) this.classList.add(name);
        else this.classList.remove(name);
        return enabled;
      },
    };
  }

  classes() {
    return this.className.split(/\s+/).filter(Boolean);
  }

  setClasses(names) {
    this.className = names.join(" ");
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }

  addEventListener(name, callback) {
    this.listeners[name] = callback;
  }
}

function createApp(fetch, ethereum, Chain) {
  const elements = new Map();
  const getElement = (id) => {
    if (!elements.has(id)) elements.set(id, new Element(id));
    return elements.get(id);
  };
  const screens = ["overview-screen", "markets-screen", "trade-screen"].map(
    getElement,
  );
  const navigation = ["overview", "markets", "trade"].map((screen) => {
    const element = new Element();
    element.dataset.screen = screen;
    return element;
  });
  const routes = [
    ...navigation,
    ...["overview", "markets", "trade"].map((screen) => {
      const element = new Element();
      element.dataset.screenTarget = screen;
      return element;
    }),
  ];
  const ranges = ["1D", "1W", "1M", "ALL"].map((range) => {
    const element = new Element();
    element.dataset.range = range;
    return element;
  });
  const chartModes = ["line", "candles"].map((chart) => {
    const element = new Element();
    element.dataset.chart = chart;
    return element;
  });
  const labels = Array.from({ length: 5 }, () => new Element());
  const amountButtons = ["100", "500", "1000", "2500"].map((amount) => {
    const element = new Element();
    element.dataset.amount = amount;
    return element;
  });
  const leverageButtons = ["1×", "5×", "10×", "25×", "50×"].map((text) => {
    const element = new Element();
    element.textContent = text;
    return element;
  });
  const sideButtons = ["long", "short"].map((side) => {
    const element = new Element();
    element.dataset.side = side;
    return element;
  });
  let latestMarketElements = [];

  const marketElements = () => {
    const html = `${getElement("market-grid").innerHTML}${getElement("ticks").innerHTML}`;
    return [...html.matchAll(/<button\b[^>]*data-market="([^"]+)"[^>]*>/g)].map(
      (match) => {
        const element = new Element();
        element.dataset.market = match[1];
        element.className = match[0].match(/class="([^"]*)"/)?.[1] ?? "";
        return element;
      },
    );
  };
  const categoryElements = () =>
    [
      ...getElement("market-filters").innerHTML.matchAll(
        /data-category="([^"]+)"/g,
      ),
    ].map((match) => {
      const element = new Element();
      element.dataset.category = match[1];
      return element;
    });

  const document = {
    querySelector(selector) {
      return getElement(
        selector.startsWith("#") ? selector.slice(1) : selector,
      );
    },
    querySelectorAll(selector) {
      if (selector === ".app-screen") return screens;
      if (selector === "nav [data-screen]") return navigation;
      if (selector === "[data-screen], [data-screen-target]") return routes;
      if (selector === "[data-range]") return ranges;
      if (selector === ".chart-controls [data-range]") return ranges;
      if (selector === "[data-chart]") return chartModes;
      if (selector === ".chart-labels span") return labels;
      if (selector === "[data-amount]") return amountButtons;
      if (selector === ".lever-pills button") return leverageButtons;
      if (selector === ".tabs button") return sideButtons;
      if (selector === "[data-market]")
        return (latestMarketElements = marketElements());
      if (selector === ".market-filters [data-category]")
        return categoryElements();
      return [];
    },
    addEventListener() {},
  };
  const window = {
    location: { hash: "" },
    ethereum,
    history: {
      pushState(_state, _title, path) {
        window.location.hash = path;
      },
    },
    scrollTo() {},
    addEventListener() {},
  };

  const context = vm.createContext({
      Chain,
      document,
      window,
      fetch,
      URL,
      AbortSignal,
      console: { ...console, error() {} },
      Math,
      Intl,
      Number,
      Array,
      Object,
      String,
      Error,
      Set,
      Map,
      JSON,
      Promise,
      setInterval: () => 1,
      setTimeout,
      clearTimeout,
  });
  vm.runInContext(readFileSyncMain, context, { filename: "src/main.js" });

  return {
    run: (code) => vm.runInContext(code, context),
    elements,
    getElement,
    latestMarketElements: () => latestMarketElements,
    navigation,
    chartModes,
    waitForInitialFeed: () => new Promise((resolve) => setTimeout(resolve, 0)),
  };
}

const readFileSyncMain = await readFile(
  new URL("../src/main.js", import.meta.url),
  "utf8",
);

function marketFeedPage(offset, total = 200) {
  const data = Array.from({ length: Math.min(100, total - offset) }, (_, i) => {
    const index = offset + i;
    return {
      id: `event-${index}`,
      title: `Event ${index}`,
      category: "Sports",
      status: "active",
      volume24h: 1240,
      contracts: [
        {
          id: `contract-${index}-a`,
          label: `Outcome ${index}A`,
          status: "active",
          marketState: "open",
          prices: { lastTradePrice: "0.53" },
        },
        {
          id: `contract-${index}-b`,
          label: `Outcome ${index}B`,
          status: "active",
          marketState: "open",
          prices: { lastTradePrice: "0.47" },
        },
        {
          id: `contract-${index}-closed`,
          label: "Closed outcome",
          status: "closed",
          marketState: "closed",
          prices: { lastTradePrice: "0.5" },
        },
      ],
    };
  });
  return { data, pagination: { total } };
}

test("imports open markets in batches and supports navigation, filtering, and trading", async () => {
  const offsets = [];
  const app = createApp(async (url) => {
    const offset = Number(new URL(url).searchParams.get("offset"));
    offsets.push(offset);
    return {
      ok: true,
      json: async () => marketFeedPage(offset),
    };
  });
  await app.waitForInitialFeed();

  assert.equal(app.getElement("market-count").textContent, "200");
  assert.match(app.getElement("market-filters").innerHTML, /Sports/);
  assert.deepEqual(offsets, [0]);

  app.navigation
    .find((link) => link.dataset.screen === "markets")
    .onclick({
      preventDefault() {},
    });
  assert.equal(app.getElement("markets-screen").hidden, false);
  assert.equal(app.getElement("trade-screen").hidden, true);

  app.getElement("show-more-markets").onclick();
  assert.equal(
    (app.getElement("market-grid").innerHTML.match(/class="market-card/g) ?? [])
      .length,
    72,
  );

  await app.getElement("load-more-markets").onclick();
  assert.equal(app.getElement("market-count").textContent, "400");
  assert.deepEqual(offsets, [0, 100]);

  const importedCard = app
    .latestMarketElements()
    .find((element) => element.dataset.market === "gemini-contract-0-a");
  assert.ok(importedCard?.onclick);
  importedCard.onclick();
  assert.equal(app.getElement("trade-screen").hidden, false);
  assert.match(app.getElement("title").textContent, /Outcome 0A/);

  app.chartModes.find((button) => button.dataset.chart === "candles").onclick();
  assert.match(app.getElement("chart-candles").innerHTML, /<rect/);
});

test("reports a feed error and retries the failed import", async () => {
  let attempts = 0;
  const app = createApp(async () => {
    attempts += 1;
    if (attempts === 1) throw Error("offline");
    return {
      ok: true,
      json: async () => ({
        data: [
          {
            id: "retry-event",
            title: "Retry event",
            category: "Climate",
            status: "active",
            contracts: [
              {
                id: "retry-contract",
                label: "Retry outcome",
                status: "active",
                marketState: "open",
                prices: { lastTradePrice: "0.5" },
              },
            ],
          },
        ],
        pagination: { total: 1 },
      }),
    };
  });
  await app.waitForInitialFeed();
  assert.match(app.getElement("feed-status").textContent, /offline/);
  assert.equal(app.getElement("load-more-markets").textContent, "Retry import");

  await app.getElement("load-more-markets").onclick();
  assert.equal(attempts, 2);
  assert.equal(app.getElement("market-count").textContent, "01");
  assert.match(app.getElement("feed-status").textContent, /1 OPEN CONTRACTS/);
});

test("connects MetaMask to Monad Testnet and reacts to wallet changes", async () => {
  const events = new Map();
  const calls = [];
  const account = "0x1234567890abcdef";
  const provider = {
    isMetaMask: true,
    async request({ method }) {
      calls.push(method);
      if (method === "eth_chainId") return "0x279f";
      if (method === "eth_requestAccounts") return [account];
      return null;
    },
    on(event, callback) {
      events.set(event, callback);
    },
  };
  const app = createApp(async () => ({ ok: false, status: 503 }), provider);

  await app.getElement("wallet").onclick();

  assert.deepEqual(calls, [
    "wallet_switchEthereumChain",
    "eth_chainId",
    "eth_requestAccounts",
  ]);
  assert.equal(app.getElement("wallet span").textContent, "0x1234...cdef");
  assert.match(
    app.getElement("notice").textContent,
    /connected to Monad Testnet/i,
  );
  // Reference-only (Gemini) markets can't be traded until listed on-chain.
  assert.match(app.getElement("trade").textContent, /Not listed on-chain/);

  events.get("chainChanged")("0x1");
  assert.equal(app.getElement("wallet span").textContent, "Switch network");
  assert.match(app.getElement("trade").textContent, /Connect MetaMask/);

  events.get("accountsChanged")([]);
  assert.equal(app.getElement("wallet span").textContent, "Connect MetaMask");
});

test("ticket math mirrors the contract: skewed entry and liquidation price", () => {
  const app = createApp(async () => ({ ok: false, status: 503 }));
  const m = { price: 50, oiCap: 1000, skew: 0.1, longOI: 0, shortOI: 0 };
  app.run(`globalThis.m = ${JSON.stringify(m)}`);
  assert.equal(app.run("entryPrice(m, true, 200)").toFixed(2), "52.00");
  assert.equal(app.run("entryPrice(m, false, 200)").toFixed(2), "48.00");
  assert.equal(app.run("liquidationPrice(50, true, 10)").toFixed(2), "45.50");
  assert.equal(app.run("liquidationPrice(50, false, 10)").toFixed(2), "54.50");
});

test("trade button sends a real open with a 0.5c slippage limit", async () => {
  const opens = [];
  const provider = {
    isMetaMask: true,
    async request({ method }) {
      return method === "eth_chainId" ? "0x279f" : method === "eth_requestAccounts" ? ["0xabc0000000000000"] : null;
    },
    on() {},
  };
  const Chain = {
    async open(...args) {
      opens.push(args.slice(1));
      return "0x1234567890abcdef";
    },
    errorText: (e) => String(e),
  };
  const app = createApp(
    async (url) => ({ ok: true, json: async () => marketFeedPage(Number(new URL(url).searchParams.get("offset")), 1) }),
    provider,
    Chain,
  );
  await app.waitForInitialFeed();
  await app.getElement("wallet").onclick();
  app.run(`markets[0].chainIdx = 7; active = markets[0]; active.price = 40;`);
  app.getElement("amount").value = "2";
  app.getElement("leverage").value = "5";
  await app.getElement("trade").onclick();
  assert.deepEqual(opens, [[7, true, 5, 2, 40.5]]); // idx, long, leverage, MON, entry 40c + 0.5c
  assert.match(app.getElement("notice").textContent, /Position opened/);
});

test("entry price skews from the oracle index, not the already-skewed mark", () => {
  const app = createApp(async () => ({ ok: false, status: 503 }));
  // mark 52 already includes +2c from 200 net long; a new 100 long moves index 50 to 53, not 54
  app.run(`globalThis.m = { index: 50, price: 52, oiCap: 1000, skew: 0.1, longOI: 200, shortOI: 0 }`);
  assert.equal(app.run("entryPrice(m, true, 100)").toFixed(2), "53.00");
});
