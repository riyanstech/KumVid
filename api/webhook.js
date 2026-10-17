

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Ganti message_id dengan nomor pesan video yang benar di channel.
const MOVIES = [
  {
    title: "Cewek Pramuka Colmek",
    genre: "Colmek",
    message_id: 5
  },
  {
    title: "Main di Mobil Sama Ayang",
    genre: "Main",
    message_id: 6
  },
  {
    title: "Ngemot Punya Ayang di Kelas",
    genre: "Main",
    message_id: 7
  },
  {
    title: "Cewek Hijab Mulus Colmek",
    genre: "Colmek",
    message_id: 8
  },
  {
    title: "Main Sama Adik",
    genre: "Main",
    message_id: 9
  },
 {
    title: "Anak SD Colmek",
    genre: "Colmek",
    message_id: 10
  }



];

async function telegram(method, data) {
  if (!BOT_TOKEN) {
    throw new Error("BOT_TOKEN belum diatur di Vercel");
  }

  let response;

  try {
    response = await fetch(`${TELEGRAM_API}/${method}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(15000)
    });
  } catch (error) {
    console.error("Telegram network error:", {
      method,
      name: error.name,
      message: error.message,
      cause: error.cause?.message,
      code: error.cause?.code
    });

    throw new Error(
      `Koneksi Telegram gagal (${method}): ${
        error.cause?.code || error.message
      }`
    );
  }

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error(`Respons Telegram bukan JSON (${method})`);
  }

  if (!response.ok || !result.ok) {
    console.error("Telegram API error:", {
      method,
      status: response.status,
      description: result.description
    });

    throw new Error(
      `Telegram API ${method}: ${
        result.description || response.status
      }`
    );
  }

  return result;
}

async function sendMessage(chatId, text, replyMarkup) {
  return telegram("sendMessage", {
    chat_id: chatId,
    text,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {})
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("Telegram Film Bot aktif");
  }

  // Verifikasi secret token dari webhook Telegram.
  if (
    !WEBHOOK_SECRET ||
    req.headers["x-telegram-bot-api-secret-token"] !==
      WEBHOOK_SECRET
  ) {
    return res.status(403).send("Forbidden");
  }

  const update = req.body;
  const message = update?.message;
  const callback = update?.callback_query;

  // Abaikan update yang tidak digunakan bot ini.
  if (!message && !callback) {
    return res.status(200).json({ ok: true });
  }

  try {
    if (message) {
      const chatId = message.chat.id;
      const text = (message.text || "").trim();

      if (text === "/start") {
        await sendMessage(
          chatId,
          "🎬 DAFTAR VIDEO HOT\n\nPilih menu untuk melihat daftar video.",
          {
            inline_keyboard: [
              [
                {
                  text: "🎞️ Lihat Daftar Video",
                  callback_data: "catalog"
                }
              ]
            ]
          }
        );
      }

      return res.status(200).json({ ok: true });
    }

    if (callback) {
      const chatId = callback.message.chat.id;
      const data = callback.data;

      await telegram("answerCallbackQuery", {
        callback_query_id: callback.id
      });

      if (data === "catalog") {
        const buttons = MOVIES.map((movie, index) => [
          {
            text: `${movie.title} · ${movie.genre}`,
            callback_data: `movie:${index}`
          }
        ]);

        if (buttons.length === 0) {
          await sendMessage(chatId, "Video masih kosong.");
        } else {
          await sendMessage(
            chatId,
            "💦 PILIH VIDEO YANG INGIN DITONTON:",
            { inline_keyboard: buttons }
          );
        }

        return res.status(200).json({ ok: true });
      }

      if (data.startsWith("movie:")) {
        const index = Number(data.slice(6));

        if (
          !Number.isInteger(index) ||
          index < 0 ||
          index >= MOVIES.length
        ) {
          await sendMessage(chatId, "Video tidak ditemukan.");
          return res.status(200).json({ ok: true });
        }

        if (!CHANNEL_ID) {
          throw new Error("CHANNEL_ID belum diatur di Vercel");
        }

        const movie = MOVIES[index];

        await telegram("copyMessage", {
          chat_id: chatId,
          from_chat_id: CHANNEL_ID,
          message_id: movie.message_id
        });

        return res.status(200).json({ ok: true });
      }
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Bot processing error:", {
      message: error.message,
      cause: error.cause?.message,
      stack: error.stack
    });

    // Berikan error HTTP agar Telegram dapat mencoba kembali
    // memproses update ini.
    return res.status(500).json({
      ok: false,
      error: "Bot processing failed"
    });
  }
}
