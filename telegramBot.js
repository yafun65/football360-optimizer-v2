// =========================================================
// FOOTBALL 360 TELEGRAM BOT
// Beta Interface
// =========================================================

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_URL = "https://football360-optimizer-v2.onrender.com";

let offset = 0;
let polling = false;

async function telegram(method, body = {}) {
  const response = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/${method}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }
  );

  return response.json();
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function sendMessage(chatId, text, extra = {}) {
  return telegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    ...extra
  });
}

function mainMenu() {
  return {
    inline_keyboard: [
      [
        { text: "5x", callback_data: "optimize_5" },
        { text: "10x", callback_data: "optimize_10" }
      ],
      [
        { text: "20x", callback_data: "optimize_20" },
        { text: "50x", callback_data: "optimize_50" }
      ],
      [
        { text: "100x", callback_data: "optimize_100" }
      ]
    ]
  };
}

async function optimize(chatId, target) {
  await sendMessage(
    chatId,
    `⚽ <b>Football 360 Optimizer</b>\n\nSearching the current SportyBet markets for a <b>${target}x</b> combination...\n\n⏳ Please wait.`
  );

  try {
    const response = await fetch(
      `${API_URL}/optimize?target=${encodeURIComponent(target)}`
    );

    const data = await response.json();

    if (!data.success) {
      await sendMessage(
        chatId,
        `⚠️ <b>No ${target}x combination generated.</b>\n\n` +
        `The backend could not currently build this target.\n\n` +
        `<i>Backend message:</i> ${escapeHtml(
          data.oldApiResponse?.error ||
          data.error ||
          "No combination available."
        )}`,
        {
          reply_markup: mainMenu()
        }
      );

      return;
    }

    const engine = data.engineResult || {};
    const combination = engine.combination || {};
    const selections = combination.selections || [];

    let message =
      `⚽ <b>FOOTBALL 360 OPTIMIZER</b>\n\n` +
      `🎯 Target: <b>${target}x</b>\n` +
      `📊 Generated: <b>${combination.combinedOdds || target}x</b>\n` +
      `🧩 Selections: <b>${selections.length}</b>\n\n`;

    message += `<b>SELECTIONS</b>\n\n`;

    selections.forEach((item, index) => {
      message +=
        `<b>${index + 1}. ${escapeHtml(item.eventName)}</b>\n` +
        `Pick: ${escapeHtml(item.selection)}\n` +
        `Market: ${escapeHtml(item.marketName)}\n` +
        `Odds: <b>${item.odds}</b>\n` +
        `League: ${escapeHtml(item.competition)}\n\n`;
    });

    message +=
      `━━━━━━━━━━━━━━\n` +
      `⚠️ <i>Beta result. Odds and markets can change before placement.</i>\n` +
      `━━━━━━━━━━━━━━`;

    await sendMessage(chatId, message, {
      reply_markup: mainMenu()
    });

  } catch (error) {
    console.error("Telegram optimize error:", error);

    await sendMessage(
      chatId,
      `❌ <b>Something went wrong.</b>\n\nPlease try again.`,
      {
        reply_markup: mainMenu()
      }
    );
  }
}

async function handleMessage(message) {
  if (!message || !message.chat) return;

  const chatId = message.chat.id;
  const text = String(message.text || "").trim();

  if (text === "/start") {
    await sendMessage(
      chatId,
      `⚽ <b>Welcome to Football 360 Optimizer</b>\n\n` +
      `This is the beta version of the Football 360 football selection engine.\n\n` +
      `Choose a target below to generate a combination from available SportyBet markets.\n\n` +
      `⚠️ <i>Beta testing only. Results are not guaranteed.</i>`,
      {
        reply_markup: mainMenu()
      }
    );

    return;
  }

  if (text === "/help") {
    await sendMessage(
      chatId,
      `⚽ <b>Football 360 Help</b>\n\n` +
      `/start — Open the main menu\n` +
      `/help — Show this help\n` +
      `/optimize 5 — Generate 5x\n` +
      `/optimize 10 — Generate 10x\n` +
      `/optimize 20 — Generate 20x\n` +
      `/optimize 50 — Generate 50x\n` +
      `/optimize 100 — Generate 100x`,
      {
        reply_markup: mainMenu()
      }
    );

    return;
  }

  const match = text.match(/^\/optimize\s+(\d+(?:\.\d+)?)$/i);

  if (match) {
    const target = Number(match[1]);

    if (target <= 1) {
      await sendMessage(
        chatId,
        "Please enter a target greater than 1x.",
        {
          reply_markup: mainMenu()
        }
      );
      return;
    }

    await optimize(chatId, target);
    return;
  }

  await sendMessage(
    chatId,
    `Use the buttons below or send a command such as:\n\n` +
    `<code>/optimize 10</code>`,
    {
      reply_markup: mainMenu()
    }
  );
}

async function handleUpdate(update) {
  if (update.callback_query) {
    const callback = update.callback_query;

    await telegram("answerCallbackQuery", {
      callback_query_id: callback.id
    });

    const match = String(callback.data || "").match(/^optimize_(.+)$/);

    if (match) {
      const target = Number(match[1]);

      if (callback.message && callback.message.chat) {
        await optimize(callback.message.chat.id, target);
      }
    }

    return;
  }

  if (update.message) {
    await handleMessage(update.message);
  }
}

async function pollTelegram() {
  if (polling) return;

  polling = true;

  console.log("Football 360 Telegram bot polling started.");

  while (true) {
    try {
      const result = await telegram("getUpdates", {
        offset,
        timeout: 25,
        allowed_updates: ["message", "callback_query"]
      });

      if (result.ok && Array.isArray(result.result)) {
        for (const update of result.result) {
          offset = update.update_id + 1;

          try {
            await handleUpdate(update);
          } catch (error) {
            console.error("Telegram update error:", error);
          }
        }
      }
    } catch (error) {
      console.error("Telegram polling error:", error.message);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

function startTelegramBot() {
  if (!BOT_TOKEN) {
    console.log(
      "Telegram bot disabled: TELEGRAM_BOT_TOKEN is not configured."
    );
    return;
  }

  pollTelegram();
}

module.exports = {
  startTelegramBot
};
