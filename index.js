const {
    Client,
    GatewayIntentBits,
    Partials
} = require("discord.js");

// ==============================
// AYARLAR
// ==============================

const TOKEN = process.env.TOKEN;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [
        Partials.Channel,
        Partials.Message,
        Partials.User,
        Partials.GuildMember
    ]
});

// ==============================
// TOKEN KONTROLÜ
// ==============================

if (!TOKEN) {
    console.error("❌ TOKEN bulunamadı!");
    console.error("Railway > Variables bölümüne TOKEN eklemelisin.");
    process.exit(1);
}

// ==============================
// BOT HAZIR
// ==============================

client.once("ready", () => {
    console.log("=================================");
    console.log("✅ BOT BAŞARIYLA AKTİF!");
    console.log(`🤖 Bot: ${client.user.tag}`);
    console.log(`🆔 ID: ${client.user.id}`);
    console.log(`🌐 Sunucu Sayısı: ${client.guilds.cache.size}`);
    console.log("=================================");
});

// ==============================
// MESAJ SİSTEMİ
// ==============================

client.on("messageCreate", async (message) => {
    try {
        if (message.author.bot) return;

        if (!message.content.startsWith(".")) return;

        const args = message.content.slice(1).trim().split(/\s+/);
        const command = args.shift()?.toLowerCase();

        // ==========================
        // .ping
        // ==========================

        if (command === "ping") {
            return message.reply(
                `🏓 Pong!\nGecikme: **${client.ws.ping}ms**`
            );
        }

        // ==========================
        // .bot
        // ==========================

        if (command === "bot") {
            return message.reply(
                `🤖 **Bot Bilgileri**\n\n` +
                `• Bot: **${client.user.tag}**\n` +
                `• Sunucu: **${client.guilds.cache.size}**\n` +
                `• Ping: **${client.ws.ping}ms**`
            );
        }

        // ==========================
        // .yardım
        // ==========================

        if (command === "yardım" || command === "help") {
            return message.reply(
                `📚 **Futbol RP Bot Komutları**\n\n` +
                `🏓 \`.ping\` — Bot gecikmesini gösterir.\n` +
                `🤖 \`.bot\` — Bot bilgilerini gösterir.\n` +
                `📚 \`.yardım\` — Komut listesini gösterir.`
            );
        }

    } catch (error) {
        console.error("❌ Komut hatası:", error);
    }
});

// ==============================
// HATA YAKALAMA
// ==============================

client.on("error", (error) => {
    console.error("❌ Discord Client Hatası:");
    console.error(error);
});

process.on("unhandledRejection", (error) => {
    console.error("❌ Unhandled Rejection:");
    console.error(error);
});

process.on("uncaughtException", (error) => {
    console.error("❌ Uncaught Exception:");
    console.error(error);
});

// ==============================
// BOTU BAŞLAT
// ==============================

client.login(TOKEN)
    .then(() => {
        console.log("🔄 Discord'a bağlanılıyor...");
    })
    .catch((error) => {
        console.error("❌ Discord'a giriş yapılamadı!");
        console.error(error);
    });
