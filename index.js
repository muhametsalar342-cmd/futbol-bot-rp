const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  ChannelType
} = require("discord.js");

const fs = require("fs");

/* =========================================================
   UNITED LEAGUE BOT
   Discord.js v14
   Prefix: .
   ========================================================= */

const TOKEN = process.env.TOKEN;
const PREFIX = ".";

const ANNOUNCE_CHANNEL_ID = "1544653653330108477";

const ROLE = {
  YONETICI: "1544449436011339806",
  KAYIT: "1544452022764568656",
  DEGER: "1544451743746891806"
};

/* =========================================================
   CLIENT
   ========================================================= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

/* =========================================================
   DATABASE
   ========================================================= */

const DATA_FILE = "./data.json";

const defaultData = {
  players: {},
  teams: {},
  transfers: [],
  kap: {},
  matches: [],
  giveaways: [],
  companies: {},
  sponsors: {},
  ads: [],
  tickets: {},
  season: 1
};

let db;

if (fs.existsSync(DATA_FILE)) {
  try {
    db = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    db = defaultData;
  }
} else {
  db = defaultData;
}

function save() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

/* =========================================================
   MONEY
   ========================================================= */

function parseMoney(value) {
  if (!value) return NaN;

  let text = String(value)
    .replace(/€/g, "")
    .replace(/,/g, ".")
    .trim()
    .toUpperCase();

  const match = text.match(/^(-?\d+(?:\.\d+)?)\s*(K|M|B)?$/);

  if (!match) return NaN;

  const number = parseFloat(match[1]);
  const unit = match[2] || "";

  const multiplier = {
    K: 1000,
    M: 1000000,
    B: 1000000000,
    "": 1
  }[unit];

  return Math.round(number * multiplier);
}

function money(value) {
  value = Number(value) || 0;

  if (value >= 1000000000) {
    return `${+(value / 1000000000).toFixed(2)}B€`;
  }

  if (value >= 1000000) {
    return `${+(value / 1000000).toFixed(2)}M€`;
  }

  if (value >= 1000) {
    return `${+(value / 1000).toFixed(2)}K€`;
  }

  return `${Math.round(value)}€`;
}

/* =========================================================
   PLAYER DATA
   ========================================================= */

function getPlayer(id) {
  if (!db.players[id]) {
    db.players[id] = {
      value: 0,
      budget: 0,
      training: 0,
      matches: 0,
      goals: 0,
      assists: 0,
      penalties: 0,
      penaltyGoals: 0,
      xp: 0,
      trophies: 0,
      achievements: [],
      team: null,
      position: "Yok"
    };
  }

  return db.players[id];
}

function addXP(id, amount) {
  const player = getPlayer(id);
  player.xp += amount;
}

/* =========================================================
   NICKNAME
   ========================================================= */

async function updateValueNickname(member, value) {
  if (!member) return;

  const oldName = member.nickname || member.user.username;

  const parts = oldName
    .split("|")
    .map(x => x.trim());

  const last = parts[parts.length - 1];

  if (/^-?\d+(?:\.\d+)?(?:K|M|B)?€$/i.test(last)) {
    parts[parts.length - 1] = money(value);
  } else {
    parts.push(money(value));
  }

  await member
    .setNickname(parts.join(" | "))
    .catch(() => {});
}

/* =========================================================
   PERMISSIONS
   ========================================================= */

function isAdmin(message) {
  return (
    message.memberPermissions?.has(
      PermissionsBitField.Flags.Administrator
    ) ||
    message.member?.roles.cache.has(ROLE.YONETICI)
  );
}

function hasRole(message, roleId) {
  return message.member?.roles.cache.has(roleId);
}

function canRegister(message) {
  return isAdmin(message) || hasRole(message, ROLE.KAYIT);
}

function canValue(message) {
  return isAdmin(message) || hasRole(message, ROLE.DEGER);
}

/* =========================================================
   EMBED
   ========================================================= */

function makeEmbed(title, description) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(0x5865f2)
    .setTimestamp()
    .setFooter({
      text: "United League"
    });
}

/* =========================================================
   TEAM
   ========================================================= */

function getTeamByOwner(id) {
  return Object.values(db.teams).find(
    team => team.owner === id
  );
}

function getTeamByName(name) {
  if (!name) return null;

  return Object.values(db.teams).find(
    team =>
      team.name.toLowerCase() ===
      name.toLowerCase()
  );
}

function ensureTeam(team) {
  team.budget ??= 100000000;
  team.players ??= [];
  team.formation ??= "4-3-3";
  team.positions ??= {};
  team.stats ??= {
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    gf: 0,
    ga: 0
  };
}

/* =========================================================
   FORMATIONS
   ========================================================= */

const FORMATIONS = {
  "4-3-3": [
    "GK",
    "RB",
    "CB",
    "CB",
    "LB",
    "CM",
    "CM",
    "CAM",
    "RW",
    "ST",
    "LW"
  ],

  "4-4-2": [
    "GK",
    "RB",
    "CB",
    "CB",
    "LB",
    "RM",
    "CM",
    "CM",
    "LM",
    "ST",
    "ST"
  ],

  "4-2-3-1": [
    "GK",
    "RB",
    "CB",
    "CB",
    "LB",
    "CDM",
    "CDM",
    "RW",
    "CAM",
    "LW",
    "ST"
  ],

  "3-5-2": [
    "GK",
    "CB",
    "CB",
    "CB",
    "RWB",
    "CM",
    "CAM",
    "CM",
    "LWB",
    "ST",
    "ST"
  ],

  "3-4-3": [
    "GK",
    "CB",
    "CB",
    "CB",
    "RM",
    "CM",
    "CM",
    "LM",
    "RW",
    "ST",
    "LW"
  ],

  "5-3-2": [
    "GK",
    "RWB",
    "CB",
    "CB",
    "CB",
    "LWB",
    "CM",
    "CM",
    "CAM",
    "ST",
    "ST"
  ]
};

const POSITIONS = [
  "GK",
  "RB",
  "CB",
  "LB",
  "RWB",
  "LWB",
  "CDM",
  "CM",
  "CAM",
  "RM",
  "LM",
  "RW",
  "LW",
  "ST",
  "CF"
];

/* =========================================================
   NPC COMPANIES / SPONSORS
   ========================================================= */

const BRANDS = {
  Emirates: {
    companyChance: 65,
    sponsorChance: 65,
    budget: 50000000
  },

  Adidas: {
    companyChance: 60,
    sponsorChance: 75,
    budget: 45000000
  },

  Puma: {
    companyChance: 55,
    sponsorChance: 55,
    budget: 35000000
  },

  Nike: {
    companyChance: 50,
    sponsorChance: 65,
    budget: 40000000
  },

  "Coca-Cola": {
    companyChance: 45,
    sponsorChance: 50,
    budget: 30000000
  },

  Pepsi: {
    companyChance: 40,
    sponsorChance: 45,
    budget: 25000000
  },

  "Red Bull": {
    companyChance: 35,
    sponsorChance: 55,
    budget: 30000000
  },

  Mercedes: {
    companyChance: 30,
    sponsorChance: 40,
    budget: 50000000
  }
};

/* =========================================================
   DURATION
   ========================================================= */

function parseDuration(text) {
  if (!text) return NaN;

  const match = text
    .toLowerCase()
    .match(/^(\d+(?:\.\d+)?)(s|sn|dk|m|sa|h)$/);

  if (!match) return NaN;

  const number = Number(match[1]);
  const unit = match[2];

  const units = {
    s: 1000,
    sn: 1000,
    dk: 60000,
    m: 60000,
    sa: 3600000,
    h: 3600000
  };

  return number * units[unit];
}

/* =========================================================
   LOG
   ========================================================= */

async function logAction(guild, text) {
  const channel = guild.channels.cache.find(
    channel =>
      channel.isTextBased() &&
      /log|kayıt-log|kayit-log/i.test(channel.name || "")
  );

  if (!channel) return;

  channel
    .send({
      embeds: [
        makeEmbed(
          "📜 United League Log",
          text
        )
      ]
    })
    .catch(() => {});
}

/* =========================================================
   HOURLY BOT STATUS
   ========================================================= */

async function sendHourlyStatus() {
  const channel = await client.channels
    .fetch(ANNOUNCE_CHANNEL_ID)
    .catch(() => null);

  if (!channel || !channel.isTextBased()) return;

  const ping = client.ws.ping;

  const totalMembers =
    client.guilds.cache.reduce(
      (total, guild) =>
        total + (guild.memberCount || 0),
      0
    );

  const uptime = Math.floor(process.uptime());

  const hours = Math.floor(
    uptime / 3600
  );

  const minutes = Math.floor(
    (uptime % 3600) / 60
  );

  channel.send({
    embeds: [
      makeEmbed(
        "🤖 UNITED LEAGUE — BOT DURUMU",
        `🟢 **Bot Durumu:** Aktif
🏓 **Ping:** ${ping}ms
👥 **Toplam Üye:** ${totalMembers}
⏱️ **Uptime:** ${hours} saat ${minutes} dakika
⚽ **Sistemler:** Aktif

**United League • Otomatik Durum Bildirimi**`
      )
    ]
  }).catch(() => {});
}

/* =========================================================
   READY
   ========================================================= */

client.once("ready", () => {
  console.log(
    `✅ United League aktif: ${client.user.tag}`
  );

  const now = new Date();

  const millisecondsUntilHour =
    (60 - now.getMinutes()) * 60000 -
    now.getSeconds() * 1000 -
    now.getMilliseconds();

  setTimeout(() => {
    sendHourlyStatus();

    setInterval(
      sendHourlyStatus,
      60 * 60 * 1000
    );
  }, Math.max(1000, millisecondsUntilHour));
});

/* =========================================================
   MEMBER JOIN
   ========================================================= */

client.on("guildMemberAdd", async member => {
  const unregistered =
    member.guild.roles.cache.find(
      role =>
        role.name.toLowerCase() ===
        "kayıtsız"
    );

  if (unregistered) {
    await member.roles
      .add(unregistered)
      .catch(() => {});
  }

  getPlayer(member.id);
  save();

  const registrationChannel =
    member.guild.channels.cache.find(
      channel =>
        channel.isTextBased() &&
        /kayıt|kayit/i.test(
          channel.name || ""
        )
    );

  if (registrationChannel) {
    registrationChannel.send({
      embeds: [
        makeEmbed(
          "👋 Yeni Oyuncu Geldi",
          `${member} sunucuya katıldı.

📝 **Kayıt Yetkilisi:** <@&${ROLE.KAYIT}>

Oyuncunun kaydını gerçekleştirebilirsiniz.`
        )
      ]
    }).catch(() => {});
  }
});

/* =========================================================
   BUTTONS
   ========================================================= */

client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;

  /* KAYIT */

  if (
    interaction.customId ===
      "register_player" ||
    interaction.customId ===
      "register_td"
  ) {
    if (
      !interaction.member.roles.cache.has(
        ROLE.KAYIT
      ) &&
      !interaction.memberPermissions?.has(
        PermissionsBitField.Flags.Administrator
      )
    ) {
      return interaction.reply({
        content:
          "❌ Bu butonu sadece Kayıt Yetkilisi kullanabilir.",
        ephemeral: true
      });
    }

    const playerRole =
      interaction.guild.roles.cache.find(
        role =>
          role.name.toLowerCase() ===
          "futbolcu"
      );

    const tdRole =
      interaction.guild.roles.cache.find(
        role =>
          role.name.toLowerCase() ===
          "teknik direktör"
      );

    const unregistered =
      interaction.guild.roles.cache.find(
        role =>
          role.name.toLowerCase() ===
          "kayıtsız"
      );

    const isTD =
      interaction.customId ===
      "register_td";

    const selectedRole =
      isTD
        ? tdRole
        : playerRole;

    if (selectedRole) {
      await interaction.member.roles
        .add(selectedRole)
        .catch(() => {});
    }

    if (unregistered) {
      await interaction.member.roles
        .remove(unregistered)
        .catch(() => {});
    }

    const player =
      getPlayer(interaction.user.id);

    player.position =
      isTD
        ? "Teknik Direktör"
        : "Futbolcu";

    save();

    await interaction.reply({
      content:
        `✅ Kayıt tamamlandı: **${
          isTD
            ? "Teknik Direktör"
            : "Futbolcu"
        }**`,
      ephemeral: true
    });

    interaction.channel.send({
      embeds: [
        makeEmbed(
          "🎉 Yeni Kayıt",
          `${interaction.user} **${
            isTD
              ? "Teknik Direktör"
              : "Futbolcu"
          }** olarak kayıt oldu.

📝 **Kayıt Yetkilisi:** <@&${ROLE.KAYIT}>`
        )
      ]
    }).catch(() => {});

    return;
  }

  /* ÇEKİLİŞ */

  if (
    interaction.customId.startsWith(
      "giveaway:"
    )
  ) {
    const id =
      interaction.customId.split(":")[1];

    const giveaway =
      db.giveaways.find(
        x =>
          x.id === id &&
          !x.ended
      );

    if (!giveaway) {
      return interaction.reply({
        content:
          "❌ Çekiliş bulunamadı.",
        ephemeral: true
      });
    }

    if (
      !giveaway.entries.includes(
        interaction.user.id
      )
    ) {
      giveaway.entries.push(
        interaction.user.id
      );

      save();
    }

    return interaction.reply({
      content:
        "🎁 Çekilişe katıldın!",
      ephemeral: true
    });
  }

  /* KAP */

  if (
    interaction.customId.startsWith(
      "kap:"
    )
  ) {
    const parts =
      interaction.customId.split(":");

    const id = parts[1];
    const action = parts[2];

    const kap = db.kap[id];

    if (!kap || kap.done) {
      return interaction.reply({
        content:
          "❌ Bu KAP tamamlanmış.",
        ephemeral: true
      });
    }

    const allowed = [
      kap.playerId,
      kap.buyOwner,
      kap.sellOwner
    ].filter(Boolean);

    if (
      !allowed.includes(
        interaction.user.id
      )
    ) {
      return interaction.reply({
        content:
          "❌ Bu KAP için onay yetkin yok.",
        ephemeral: true
      });
    }

    if (action === "reject") {
      kap.done = true;
      kap.rejected = true;

      save();

      return interaction.reply(
        "❌ KAP reddedildi."
      );
    }

    if (
      !kap.approved.includes(
        interaction.user.id
      )
    ) {
      kap.approved.push(
        interaction.user.id
      );
    }

    if (
      kap.approved.length >=
      kap.required
    ) {
      const buyer =
        db.teams[kap.buyTeam];

      const seller =
        kap.sellTeam
          ? db.teams[kap.sellTeam]
          : null;

      const player =
        getPlayer(kap.playerId);

      ensureTeam(buyer);

      if (seller) {
        ensureTeam(seller);
      }

      if (
        buyer.budget <
        kap.amount
      ) {
        kap.done = true;
        kap.rejected = true;

        save();

        return interaction.reply(
          "❌ Alıcı takımın bütçesi yetersiz."
        );
      }

      buyer.budget -=
        kap.amount;

      if (seller) {
        seller.budget +=
          kap.amount;

        seller.players =
          seller.players.filter(
            id =>
              id !== kap.playerId
          );
      }

      if (
        !buyer.players.includes(
          kap.playerId
        )
      ) {
        buyer.players.push(
          kap.playerId
        );
      }

      player.team =
        buyer.id;

      db.transfers.push({
        player: kap.playerId,
        from: seller?.id || null,
        to: buyer.id,
        amount: kap.amount,
        date: Date.now()
      });

      kap.done = true;

      save();

      return interaction.reply(
        "✅ Tüm onaylar geldi. Transfer tamamlandı!"
      );
    }

    save();

    return interaction.reply(
      `✅ Onayın kaydedildi. **${kap.approved.length}/${kap.required}**`
    );
  }

  /* TICKET BUTTON */

  if (
    interaction.customId.startsWith(
      "ticket_close:"
    )
  ) {
    const id =
      interaction.customId.split(":")[1];

    const ticket =
      db.tickets[id];

    if (!ticket) {
      return interaction.reply({
        content:
          "❌ Ticket bulunamadı.",
        ephemeral: true
      });
    }

    if (
      interaction.user.id !==
        ticket.owner &&
      !isAdmin(interaction)
    ) {
      return interaction.reply({
        content:
          "❌ Bu ticketı kapatamazsın.",
        ephemeral: true
      });
    }

    delete db.tickets[id];

    save();

    await interaction.reply(
      "🔒 Ticket kapatılıyor..."
    );

    setTimeout(() => {
      interaction.channel
        .delete()
        .catch(() => {});
    }, 1000);
  }
});

/* =========================================================
   COMMANDS
   ========================================================= */

client.on("messageCreate", async message => {
  if (
    message.author.bot ||
    !message.guild ||
    !message.content.startsWith(PREFIX)
  ) {
    return;
  }

  const parts =
    message.content
      .slice(PREFIX.length)
      .trim()
      .split(/\s+/);

  const command =
    (parts.shift() || "")
      .toLowerCase();

  const args = parts;

  const target =
    message.mentions.members.first();

  try {

    /* =====================================================
       PING
       ===================================================== */

    if (command === "ping") {
      return message.reply({
        embeds: [
          makeEmbed(
            "🏓 UNITED LEAGUE",
            `💻 **Bot Gecikmesi:** ${
              Date.now() -
              message.createdTimestamp
            }ms

🌐 **API Gecikmesi:** ${
              client.ws.ping
            }ms

⏱️ **Uptime:** ${
              Math.floor(
                process.uptime() / 3600
              )
            } saat ${
              Math.floor(
                (process.uptime() % 3600) /
                  60
              )
            } dakika

🟢 **Bot aktif!**`
          )
        ]
      });
    }

    /* =====================================================
       KAYIT
       ===================================================== */

    if (
      command === "kayıt" ||
      command === "kayit"
    ) {
      if (!canRegister(message)) {
        return message.reply(
          "❌ Kayıt Yetkilisi gerekli."
        );
      }

      const row =
        new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(
                "register_player"
              )
              .setLabel(
                "⚽ Futbolcu"
              )
              .setStyle(
                ButtonStyle.Primary
              ),

            new ButtonBuilder()
              .setCustomId(
                "register_td"
              )
              .setLabel(
                "🎩 Teknik Direktör"
              )
              .setStyle(
                ButtonStyle.Success
              )
          );

      return message.channel.send({
        embeds: [
          makeEmbed(
            "📝 UNITED LEAGUE KAYIT",
            "Kayıt türünü aşağıdaki butonlardan seçin."
          )
        ],
        components: [row]
      });
    }

    if (command === "k") {
      if (!canRegister(message)) {
        return message.reply(
          "❌ Kayıt Yetkilisi gerekli."
        );
      }

      if (!target) {
        return message.reply(
          "❌ Oyuncu etiketle."
        );
      }

      const row =
        new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(
                "register_player"
              )
              .setLabel(
                "⚽ Futbolcu"
              )
              .setStyle(
                ButtonStyle.Primary
              ),

            new ButtonBuilder()
              .setCustomId(
                "register_td"
              )
              .setLabel(
                "🎩 Teknik Direktör"
              )
              .setStyle(
                ButtonStyle.Success
              )
          );

      return message.channel.send({
        content: `${target}`,
        embeds: [
          makeEmbed(
            "📝 Oyuncu Kaydı",
            "Kayıt türünü seç."
          )
        ],
        components: [row]
      });
    }

    /* =====================================================
       PROFİL
       ===================================================== */

    if (
      command === "profil" ||
      command === "istatistik"
    ) {
      const user =
        target?.user ||
        message.author;

      const player =
        getPlayer(user.id);

      return message.reply({
        embeds: [
          makeEmbed(
            `👤 ${user.username}`,
            `💰 **Değer:** ${money(player.value)}
💵 **Bütçe:** ${money(player.budget)}
⚽ **Maç:** ${player.matches}
🥅 **Gol:** ${player.goals}
🎯 **Asist:** ${player.assists}
🥅 **Penaltı:** ${player.penaltyGoals}/${player.penalties}
🏋️ **Antrenman:** ${player.training}/10
⭐ **XP:** ${player.xp}
🏆 **Kupalar:** ${player.trophies}
📋 **Pozisyon:** ${player.position}
🎖️ **Başarılar:** ${
              player.achievements.join(", ") ||
              "Yok"
            }`
          )
        ]
      });
    }

    /* =====================================================
       DEĞER
       ===================================================== */

    if (command === "dver") {
      if (!canValue(message)) {
        return message.reply(
          "❌ Değer Yetkilisi gerekli."
        );
      }

      if (
        !target ||
        !args[1]
      ) {
        return message.reply(
          "❌ Kullanım: `.dver @oyuncu 5M`"
        );
      }

      const amount =
        parseMoney(args[1]);

      if (!Number.isFinite(amount)) {
        return message.reply(
          "❌ Geçersiz miktar."
        );
      }

      const player =
        getPlayer(target.id);

      player.value += amount;

      await updateValueNickname(
        target,
        player.value
      );

      save();

      await logAction(
        message.guild,
        `${target} değerine **${money(amount)}** eklendi.
Yeni değer: **${money(player.value)}**`
      );

      return message.reply(
        `✅ ${target} değerine **${money(amount)}** eklendi.
💰 Yeni değer: **${money(player.value)}**`
      );
    }

    if (
      command === "değer" ||
      command === "deger"
    ) {
      const user =
        target?.user ||
        message.author;

      return message.reply(
        `💰 ${user} değeri: **${money(
          getPlayer(user.id).value
        )}**`
      );
    }

    if (
      command === "değerler" ||
      command === "degerler"
    ) {
      const list =
        Object.entries(db.players)
          .sort(
            (a, b) =>
              b[1].value -
              a[1].value
          )
          .slice(0, 10)
          .map(
            (x, i) =>
              `${i + 1}. <@${x[0]}> — **${money(
                x[1].value
              )}**`
          )
          .join("\n") ||
        "Henüz oyuncu yok.";

      return message.reply({
        embeds: [
          makeEmbed(
            "💰 DEĞER SIRALAMASI",
            list
          )
        ]
      });
    }

    /* =====================================================
       ANTRENMAN
       ===================================================== */

    if (
      command === "ant" ||
      command === "antrenman"
    ) {
      const player =
        getPlayer(message.author.id);

      player.training++;

      if (player.training >= 10) {
        player.training = 0;

        player.value +=
          3000000;

        addXP(
          message.author.id,
          50
        );

        if (
          !player.achievements.includes(
            "Antrenman Ustası"
          )
        ) {
          player.achievements.push(
            "Antrenman Ustası"
          );
        }

        await updateValueNickname(
          message.member,
          player.value
        );

        save();

        return message.reply(
          `🏋️ **10/10 ANRENMAN TAMAMLANDI!**

💰 Otomatik ödül: **+3M€**
💎 Yeni değer: **${money(
            player.value
          )}**`
        );
      }

      addXP(
        message.author.id,
        10
      );

      save();

      return message.reply(
        `🏋️ Antrenman ilerlemen: **${player.training}/10**`
      );
    }

    /* =====================================================
       PENALTI
       ===================================================== */

    if (
      command === "pen" ||
      command === "penaltı" ||
      command === "penalti"
    ) {
      const player =
        getPlayer(message.author.id);

      player.penalties++;

      const goal =
        Math.random() < 0.65;

      if (goal) {
        player.penaltyGoals++;

        player.value +=
          2000000;

        addXP(
          message.author.id,
          30
        );

        if (
          player.penaltyGoals >= 5 &&
          !player.achievements.includes(
            "Penaltı Uzmanı"
          )
        ) {
          player.achievements.push(
            "Penaltı Uzmanı"
          );
        }

        await updateValueNickname(
          message.member,
          player.value
        );

        save();

        return message.reply(
          `🥅 **GOOOL!** ⚽

💰 Otomatik ödül: **+2M€**
💎 Yeni değer: **${money(
            player.value
          )}**`
        );
      }

      addXP(
        message.author.id,
        5
      );

      save();

      return message.reply(
        "🥅 ❌ Penaltı kaçtı!"
      );
    }

    /* =====================================================
       OYUNCU BÜTÇESİ
       ===================================================== */

    if (
      command === "bütçe" ||
      command === "butce"
    ) {
      const user =
        target?.user ||
        message.author;

      return message.reply(
        `💵 ${user} bütçesi: **${money(
          getPlayer(user.id).budget
        )}**`
      );
    }

    if (command === "para") {
      if (!isAdmin(message)) {
        return message.reply(
          "❌ Yönetici gerekli."
        );
      }

      if (!target) {
        return message.reply(
          "❌ Oyuncu etiketle."
        );
      }

      const amount =
        parseMoney(args[1]);

      if (!Number.isFinite(amount)) {
        return message.reply(
          "❌ Miktar hatalı."
        );
      }

      getPlayer(target.id)
        .budget += amount;

      save();

      return message.reply(
        `✅ ${target} bütçesine **${money(
          amount
        )}** eklendi.`
      );
    }

    if (
      command === "paragönder" ||
      command === "paragonder"
    ) {
      if (!target) {
        return message.reply(
          "❌ Oyuncu etiketle."
        );
      }

      const amount =
        parseMoney(args[1]);

      const sender =
        getPlayer(
          message.author.id
        );

      const receiver =
        getPlayer(target.id);

      if (
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        return message.reply(
          "❌ Miktar hatalı."
        );
      }

      if (
        sender.budget < amount
      ) {
        return message.reply(
          "❌ Yetersiz bütçe."
        );
      }

      sender.budget -= amount;
      receiver.budget += amount;

      save();

      return message.reply(
        `✅ **${money(
          amount
        )}** gönderildi.`
      );
    }

    /* =====================================================
       TAKIM OLUŞTUR
       ===================================================== */

    if (
      command === "takımoluştur" ||
      command === "takimolustur"
    ) {
      if (getTeamByOwner(message.author.id)) {
        return message.reply(
          "❌ Zaten bir takımın var."
        );
      }

      const name =
        args.join(" ");

      if (!name) {
        return message.reply(
          "❌ Takım adı yaz."
        );
      }

      if (getTeamByName(name)) {
        return message.reply(
          "❌ Bu takım zaten var."
        );
      }

      const role =
        await message.guild.roles.create({
          name,
          color:
            Math.floor(
              Math.random() *
                0xffffff
            ),
          hoist: true,
          reason:
            "United League takım rolü"
        }).catch(() => null);

      const tdRole =
        message.guild.roles.cache.find(
          r =>
            r.name.toLowerCase() ===
            "teknik direktör"
        );

      if (tdRole) {
        await message.member.roles
          .add(tdRole)
          .catch(() => {});
      }

      if (role) {
        await message.member.roles
          .add(role)
          .catch(() => {});
      }

      const id =
        Date.now().toString();

      db.teams[id] = {
        id,
        name,
        owner:
          message.author.id,
        roleId:
          role?.id || null,
        budget:
          100000000,
        players: [],
        formation:
          "4-3-3",
        positions: {},
        stats: {
          played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          gf: 0,
          ga: 0
        }
      };

      getPlayer(
        message.author.id
      ).team = id;

      save();

      return message.reply(
        `🏟️ **${name}** oluşturuldu!

🎩 Teknik Direktör: ${message.author}
💰 Başlangıç bütçesi: **100M€**
📋 Formasyon: **4-3-3**`
      );
    }

    /* =====================================================
       TAKIM
       ===================================================== */

    if (
      command === "takım" ||
      command === "takim"
    ) {
      const team =
        getTeamByOwner(
          message.author.id
        );

      if (!team) {
        return message.reply(
          "❌ Takımın yok."
        );
      }

      ensureTeam(team);

      return message.reply({
        embeds: [
          makeEmbed(
            `🏟️ ${team.name}`,
            `🎩 **TD:** <@${team.owner}>
💰 **Bütçe:** ${money(team.budget)}
📋 **Formasyon:** ${team.formation}
👥 **Oyuncu:** ${team.players.length}
⚽ **Maç:** ${team.stats.played}
🏆 **Galibiyet:** ${team.stats.wins}`
          )
        ]
      });
    }

    if (
      command === "takımım" ||
      command === "takimim"
    ) {
      const team =
        getTeamByOwner(
          message.author.id
        );

      return message.reply(
        team
          ? `🏟️ Takımın: **${team.name}**`
          : "❌ Takımın yok."
      );
    }

    if (
      command === "takımlar" ||
      command === "takimlar"
    ) {
      const list =
        Object.values(db.teams)
          .map(
            team =>
              `🏟️ **${team.name}** — 💰 ${money(
                team.budget
              )} — 👥 ${team.players.length}`
          )
          .join("\n") ||
        "Takım yok.";

      return message.reply({
        embeds: [
          makeEmbed(
            "🏟️ TAKIMLAR",
            list
          )
        ]
      });
    }

    /* =====================================================
       TAKIM BÜTÇESİ
       ===================================================== */

    if (
      command === "takımbütçe" ||
      command === "takimbutce"
    ) {
      const team =
        getTeamByOwner(
          message.author.id
        );

      if (!team) {
        return message.reply(
          "❌ Takımın yok."
        );
      }

      return message.reply(
        `💰 **${team.name}** takım bütçesi: **${money(
          team.budget
        )}**`
      );
    }

    if (
      command === "takımpara" ||
      command === "takimpara"
    ) {
      const team =
        getTeamByOwner(
          message.author.id
        );

      if (
        !team ||
        (
          team.owner !==
            message.author.id &&
          !isAdmin(message)
        )
      ) {
        return message.reply(
          "❌ Sadece Teknik Direktör kullanabilir."
        );
      }

      const amount =
        parseMoney(args[0]);

      if (!Number.isFinite(amount)) {
        return message.reply(
          "❌ Miktar hatalı."
        );
      }

      team.budget += amount;

      save();

      return message.reply(
        `💰 Yeni takım bütçesi: **${money(
          team.budget
        )}**`
      );
    }

    if (
      command === "takımharca" ||
      command === "takimharca"
    ) {
      const team =
        getTeamByOwner(
          message.author.id
        );

      if (
        !team ||
        (
          team.owner !==
            message.author.id &&
          !isAdmin(message)
        )
      ) {
        return message.reply(
          "❌ Sadece Teknik Direktör kullanabilir."
        );
      }

      const amount =
        parseMoney(args[0]);

      if (
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        return message.reply(
          "❌ Miktar hatalı."
        );
      }

      if (
        team.budget < amount
      ) {
        return message.reply(
          "❌ Takım bütçesi yetersiz."
        );
      }

      team.budget -= amount;

      save();

      return message.reply(
        `💰 Harcama yapıldı.
Yeni bütçe: **${money(
          team.budget
        )}**`
      );
    }

    if (
      command ===
        "takımbütçegönder" ||
      command ===
        "takimbutcegonder"
    ) {
      const from =
        getTeamByOwner(
          message.author.id
        );

      if (!from) {
        return message.reply(
          "❌ Takımın yok."
        );
      }

      if (
        from.owner !==
          message.author.id &&
        !isAdmin(message)
      ) {
        return message.reply(
          "❌ Sadece Teknik Direktör kullanabilir."
        );
      }

      const amount =
        parseMoney(args.at(-1));

      const role =
        message.mentions.roles.first();

      let to = null;

      if (role) {
        to =
          Object.values(
            db.teams
          ).find(
            team =>
              team.roleId ===
              role.id
          );
      }

      if (!to) {
        to =
          getTeamByName(
            args
              .slice(0, -1)
              .join(" ")
          );
      }

      if (!to) {
        return message.reply(
          "❌ Alıcı takım bulunamadı."
        );
      }

      if (
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        return message.reply(
          "❌ Miktar hatalı."
        );
      }

      if (
        from.budget < amount
      ) {
        return message.reply(
          "❌ Yetersiz takım bütçesi."
        );
      }

      from.budget -= amount;
      to.budget += amount;

      save();

      return message.reply(
        `💰 **${from.name} → ${to.name}**
**${money(amount)}** gönderildi.`
      );
    }

    /* =====================================================
       KADRO
       ===================================================== */

    if (command === "kadro") {
      const team =
        getTeamByOwner(
          message.author.id
        );

      if (!team) {
        return message.reply(
          "❌ Takımın yok."
        );
      }

      ensureTeam(team);

      if (target) {
        if (
          team.owner !==
            message.author.id &&
          !isAdmin(message)
        ) {
          return message.reply(
            "❌ Sadece Teknik Direktör kadro yönetebilir."
          );
        }

        if (
          !team.players.includes(
            target.id
          )
        ) {
          team.players.push(
            target.id
          );
        }

        getPlayer(
          target.id
        ).team = team.id;

        save();

        return message.reply(
          `✅ ${target} **${team.name}** kadrosuna eklendi.`
        );
      }

      const positions =
        team.positions || {};

      const lines =
        Object.entries(
          positions
        )
          .map(
            ([position, id]) =>
              `${position} → ${
                id
                  ? `<@${id}>`
                  : "Boş"
              }`
          )
          .join("\n");

      return message.reply({
        embeds: [
          makeEmbed(
            `👥 ${team.name} KADRO`,
            `📋 **Formasyon:** ${team.formation}

${lines || "Kadro henüz oluşturulmadı."}`
          )
        ]
      });
    }

    if (
      command ===
      "kadrocikar"
    ) {
      const team =
        getTeamByOwner(
          message.author.id
        );

      if (
        !team ||
        (
          team.owner !==
            message.author.id &&
          !isAdmin(message)
        )
      ) {
        return message.reply(
          "❌ Teknik Direktör gerekli."
        );
      }

      if (!target) {
        return message.reply(
          "❌ Oyuncu etiketle."
        );
      }

      team.players =
        team.players.filter(
          id =>
            id !== target.id
        );

      for (
        const position of Object.keys(
          team.positions || {}
        )
      ) {
        if (
          team.positions[position] ===
          target.id
        ) {
          team.positions[position] =
            null;
        }
      }

      getPlayer(
        target.id
      ).team = null;

      save();

      return message.reply(
        `✅ ${target} kadrodan çıkarıldı.`
      );
    }

    /* =====================================================
       FORMASYON
       ===================================================== */

    if (command === "formasyon") {
      const team =
        getTeamByOwner(
          message.author.id
        );

      if (!team) {
        return message.reply(
          "❌ Takımın yok."
        );
      }

      if (!args[0]) {
        return message.reply(
          `📋 Mevcut formasyon: **${team.formation}**

Kullanılabilir:
${Object.keys(FORMATIONS).join(", ")}`
        );
      }

      if (!FORMATIONS[args[0]]) {
        return message.reply(
          "❌ Geçersiz formasyon."
        );
      }

      if (
        team.owner !==
          message.author.id &&
        !isAdmin(message)
      ) {
        return message.reply(
          "❌ Sadece Teknik Direktör değiştirebilir."
        );
      }

      team.formation =
        args[0];

      team.positions = {};

      FORMATIONS[
        args[0]
      ].forEach(
        position => {
          team.positions[position] =
            null;
        }
      );

      save();

      return message.reply(
        `✅ Formasyon **${args[0]}** olarak ayarlandı.

📋 Pozisyonlar:
${FORMATIONS[
          args[0]
        ].join(" • ")}`
      );
    }

    /* =====================================================
       POZİSYON
       ===================================================== */

    if (
      command === "pozisyon"
    ) {
      const team =
        getTeamByOwner(
          message.author.id
        );

      if (
        !team ||
        (
          team.owner !==
            message.author.id &&
          !isAdmin(message)
        )
      ) {
        return message.reply(
          "❌ Teknik Direktör gerekli."
        );
      }

      if (!target) {
        return message.reply(
          "❌ Oyuncu etiketle."
        );
      }

      const position =
        (
          args[1] || ""
        ).toUpperCase();

      if (
        !POSITIONS.includes(
          position
        )
      ) {
        return message.reply(
          `❌ Geçersiz pozisyon.

${POSITIONS.join(
            ", "
          )}`
        );
      }

      if (
        !team.players.includes(
          target.id
        )
      ) {
        team.players.push(
          target.id
        );
      }

      team.positions[position] =
        target.id;

      getPlayer(
        target.id
      ).team = team.id;

      getPlayer(
        target.id
      ).position =
        position;

      save();

      return message.reply(
        `✅ ${target} → **${position}**`
      );
    }

    /* =====================================================
       TRANSFER / KAP
       ===================================================== */

    if (command === "transfer") {
      if (!target) {
        return message.reply(
          "❌ Kullanım: `.transfer @oyuncu Takım 10M`"
        );
      }

      const amount =
        parseMoney(args.at(-1));

      const buyerName =
        args
          .slice(1, -1)
          .join(" ");

      const buyer =
        getTeamByName(
          buyerName
        );

      const player =
        getPlayer(target.id);

      const seller =
        player.team
          ? db.teams[
              player.team
            ]
          : null;

      if (
        !buyer ||
        !Number.isFinite(
          amount
        )
      ) {
        return message.reply(
          "❌ Takım veya miktar hatalı."
        );
      }

      const kapId =
        Date.now().toString();

      const required = [
        target.id,
        buyer.owner,
        seller?.owner
      ].filter(Boolean);

      db.kap[kapId] = {
        id: kapId,
        playerId:
          target.id,
        buyTeam:
          buyer.id,
        sellTeam:
          seller?.id || null,
        buyOwner:
          buyer.owner,
        sellOwner:
          seller?.owner || null,
        amount,
        approved: [],
        required:
          required.length,
        done: false,
        rejected: false
      };

      save();

      const row =
        new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(
                `kap:${kapId}:approve`
              )
              .setLabel(
                "✅ Onayla"
              )
              .setStyle(
                ButtonStyle.Success
              ),

            new ButtonBuilder()
              .setCustomId(
                `kap:${kapId}:reject`
              )
              .setLabel(
                "❌ Reddet"
              )
              .setStyle(
                ButtonStyle.Danger
              )
          );

      return message.channel.send({
        embeds: [
          makeEmbed(
            "📑 KAP — TRANSFER",
            `👤 **Oyuncu:** ${target}
🏟️ **Alıcı:** ${buyer.name}
🏟️ **Satıcı:** ${
              seller?.name ||
              "Serbest Oyuncu"
            }
💰 **Bedel:** ${money(
              amount
            )}

### Gerekli Onaylar
👤 Oyuncu
🎩 Alıcı Teknik Direktör
🎩 Satıcı Teknik Direktör

**Tüm gerekli kişiler kabul etmeden transfer gerçekleşmez.**`
          )
        ],
        components: [row]
      });
    }

    if (
      command ===
        "transferler" ||
      command ===
        "transfergeçmişi" ||
      command ===
        "transfergecmisi"
    ) {
      const list =
        db.transfers
          .slice(-20)
          .reverse()
          .map(
            transfer =>
              `🔄 <@${transfer.player}> → **${
                db.teams[
                  transfer.to
                ]?.name ||
                "Takım"
              }** — ${money(
                transfer.amount
              )}`
          )
          .join("\n") ||
        "Transfer yok.";

      return message.reply({
        embeds: [
          makeEmbed(
            "🔄 TRANSFERLER",
            list
          )
        ]
      });
    }

    /* =====================================================
       MAÇ
       ===================================================== */

    if (
      command === "maç" ||
      command === "mac"
    ) {
      if (!isAdmin(message)) {
        return message.reply(
          "❌ Maç Yetkilisi/Yönetici gerekli."
        );
      }

      const roles =
        [...message.mentions.roles.values()];

      let team1 =
        roles[0]
          ? Object.values(
              db.teams
            ).find(
              team =>
                team.roleId ===
                roles[0].id
            )
          : null;

      let team2 =
        roles[1]
          ? Object.values(
              db.teams
            ).find(
              team =>
                team.roleId ===
                roles[1].id
            )
          : null;

      if (!team1) {
        team1 =
          getTeamByName(
            args[0]
          );
      }

      if (!team2) {
        team2 =
          getTeamByName(
            args[1]
          );
      }

      if (
        !team1 ||
        !team2 ||
        team1.id ===
          team2.id
      ) {
        return message.reply(
          "❌ Kullanım: `.maç @takım1 @takım2`"
        );
      }

      ensureTeam(team1);
      ensureTeam(team2);

      await message.channel.send({
        embeds: [
          makeEmbed(
            "⚽ MAÇ BAŞLADI",
            `🏟️ **${team1.name}** vs **${team2.name}**

📋 ${team1.formation} — ${team2.formation}

⏱️ Maç simülasyonu başladı...`
          )
        ]
      });

      let goals1 = 0;
      let goals2 = 0;

      const events = [
        "Orta saha mücadelesi hızlandı.",
        "Tehlikeli atak gelişiyor!",
        "Kaleci gole izin vermedi.",
        "Savunma araya girdi.",
        "Şut! Top auta çıktı.",
        "Hızlı hücum başladı.",
        "Kanattan tehlikeli orta geldi.",
        "Defans topu uzaklaştırdı."
      ];

      /*
        5 dakikalık istenen sistemin
        test edilebilir hızlı simülasyonu.
      */

      for (
        let minute = 1;
        minute <= 5;
        minute++
      ) {
        await new Promise(
          resolve =>
            setTimeout(
              resolve,
              1000
            )
        );

        if (
          Math.random() <
          0.55
        ) {
          if (
            Math.random() <
            0.5
          ) {
            goals1++;

            await message.channel.send(
              `⚽ **GOOOL!** ${team1.name} gol buldu!

📊 **${goals1}-${goals2}**`
            );
          } else {
            goals2++;

            await message.channel.send(
              `⚽ **GOOOL!** ${team2.name} gol buldu!

📊 **${goals1}-${goals2}**`
            );
          }
        } else {
          await message.channel.send(
            `⏱️ **${minute}. dakika** — ${
              events[
                Math.floor(
                  Math.random() *
                    events.length
                )
              ]
            }`
          );
        }
      }

      team1.stats.played++;
      team2.stats.played++;

      team1.stats.gf +=
        goals1;
      team1.stats.ga +=
        goals2;

      team2.stats.gf +=
        goals2;
      team2.stats.ga +=
        goals1;

      if (
        goals1 > goals2
      ) {
        team1.stats.wins++;
        team2.stats.losses++;
      } else if (
        goals2 > goals1
      ) {
        team2.stats.wins++;
        team1.stats.losses++;
      } else {
        team1.stats.draws++;
        team2.stats.draws++;
      }

      for (
        const playerId of
          team1.players
      ) {
        const p =
          getPlayer(
            playerId
          );

        p.matches++;
        addXP(
          playerId,
          20
        );
      }

      for (
        const playerId of
          team2.players
      ) {
        const p =
          getPlayer(
            playerId
          );

        p.matches++;
        addXP(
          playerId,
          20
        );
      }

      db.matches.push({
        team1:
          team1.id,
        team2:
          team2.id,
        goals1,
        goals2,
        date:
          Date.now()
      });

      save();

      return message.channel.send({
        embeds: [
          makeEmbed(
            "🏁 MAÇ BİTTİ",
            `🏟️ **${team1.name} ${goals1} - ${goals2} ${team2.name}**

📊 Sonuç lige kaydedildi.
🏆 Puan durumu güncellendi.`
          )
        ]
      });
    }

    /* =====================================================
       MAÇLAR
       ===================================================== */

    if (
      command ===
        "maçlar" ||
      command ===
        "maclar"
    ) {
      const list =
        db.matches
          .slice(-15)
          .reverse()
          .map(
            match =>
              `⚽ **${
                db.teams[
                  match.team1
                ]?.name ||
                "?"
              } ${match.goals1}-${match.goals2} ${
                db.teams[
                  match.team2
                ]?.name ||
                "?"
              }**`
          )
          .join("\n") ||
        "Maç yok.";

      return message.reply({
        embeds: [
          makeEmbed(
            "⚽ SON MAÇLAR",
            list
          )
        ]
      });
    }

    if (
      command ===
        "maçsonucu" ||
      command ===
        "macsonucu"
    ) {
      const match =
        db.matches.at(-1);

      if (!match) {
        return message.reply(
          "❌ Maç yok."
        );
      }

      return message.reply(
        `⚽ **${
          db.teams[
            match.team1
          ]?.name
        } ${match.goals1}-${match.goals2} ${
          db.teams[
            match.team2
          ]?.name
        }**`
      );
    }

    /* =====================================================
       LİG / PUAN
       ===================================================== */

    if (
      command === "lig" ||
      command === "puan"
    ) {
      const list =
        Object.values(db.teams)
          .sort((a, b) => {
            const pointsA =
              a.stats.wins * 3 +
              a.stats.draws;

            const pointsB =
              b.stats.wins * 3 +
              b.stats.draws;

            const avA =
              a.stats.gf -
              a.stats.ga;

            const avB =
              b.stats.gf -
              b.stats.ga;

            return (
              pointsB -
                pointsA ||
              avB - avA
            );
          })
          .map(
            (team, index) => {
              const points =
                team.stats.wins *
                  3 +
                team.stats.draws;

              return `${index + 1}. **${team.name}** — **${points} P**
G: ${team.stats.wins} | B: ${team.stats.draws} | M: ${team.stats.losses}
⚽ ${team.stats.gf} | 🥅 ${team.stats.ga} | AV: ${
                team.stats.gf -
                team.stats.ga
              }`;
            }
          )
          .join("\n\n") ||
        "Lig boş.";

      return message.reply({
        embeds: [
          makeEmbed(
            `🏆 UNITED LEAGUE — SEZON ${db.season}`,
            list
          )
        ]
      });
    }

    /* =====================================================
       GOL KRALLIĞI
       ===================================================== */

    if (
      command ===
        "golkrallığı" ||
      command ===
        "golkralligi"
    ) {
      const list =
        Object.entries(
          db.players
        )
          .sort(
            (a, b) =>
              b[1].goals -
              a[1].goals
          )
          .slice(0, 10)
          .map(
            (x, i) =>
              `${i + 1}. <@${x[0]}> — **${x[1].goals} gol**`
          )
          .join("\n") ||
        "Gol yok.";

      return message.reply({
        embeds: [
          makeEmbed(
            "🥅 GOL KRALLIĞI",
            list
          )
        ]
      });
    }

    /* =====================================================
       ASİST KRALLIĞI
       ===================================================== */

    if (
      command ===
        "asistkrallığı" ||
      command ===
        "asistkralligi"
    ) {
      const list =
        Object.entries(
          db.players
        )
          .sort(
            (a, b) =>
              b[1].assists -
              a[1].assists
          )
          .slice(0, 10)
          .map(
            (x, i) =>
              `${i + 1}. <@${x[0]}> — **${x[1].assists} asist**`
          )
          .join("\n") ||
        "Asist yok.";

      return message.reply({
        embeds: [
          makeEmbed(
            "🎯 ASİST KRALLIĞI",
            list
          )
        ]
      });
    }

    /* =====================================================
       SEZON
       ===================================================== */

    if (
      command === "sezon"
    ) {
      return message.reply({
        embeds: [
          makeEmbed(
            "📅 SEZON",
            `🏆 **Sezon:** ${db.season}
🏟️ **Takımlar:** ${
              Object.keys(
                db.teams
              ).length
            }
⚽ **Maçlar:** ${
              db.matches.length
            }`
          )
        ]
      });
    }

    /* =====================================================
       TICKET
       ===================================================== */

    if (
      command === "ticket"
    ) {
      const channel =
        await message.guild.channels.create(
          {
            name:
              `ticket-${message.author.username}`
                .toLowerCase()
                .replace(
                  /[^a-z0-9-]/g,
                  ""
                )
                .slice(0, 80),

            type:
              ChannelType.GuildText,

            permissionOverwrites: [
              {
                id:
                  message.guild.id,

                deny: [
                  PermissionsBitField.Flags
                    .ViewChannel
                ]
              },

              {
                id:
                  message.author.id,

                allow: [
                  PermissionsBitField.Flags
                    .ViewChannel,

                  PermissionsBitField.Flags
                    .SendMessages
                ]
              }
            ]
          }
        ).catch(() => null);

      if (!channel) {
        return message.reply(
          "❌ Ticket açılamadı."
        );
      }

      db.tickets[
        channel.id
      ] = {
        owner:
          message.author.id,
        created:
          Date.now()
      };

      save();

      const row =
        new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(
                `ticket_close:${channel.id}`
              )
              .setLabel(
                "🔒 Ticket Kapat"
              )
              .setStyle(
                ButtonStyle.Danger
              )
          );

      await channel.send({
        embeds: [
          makeEmbed(
            "🎫 UNITED LEAGUE TICKET",
            `👤 **Yetkili:** ${
              message.author
            }

Yetkililer kısa süre içerisinde ilgilenecektir.`
          )
        ],
        components: [row]
      });

      return message.reply(
        `🎫 Ticket açıldı: ${channel}`
      );
    }

    if (
      command ===
      "ticketkapat"
    ) {
      if (
        !db.tickets[
          message.channel.id
        ] &&
        !isAdmin(message)
      ) {
        return message.reply(
          "❌ Bu kanal ticket değil."
        );
      }

      delete db.tickets[
        message.channel.id
      ];

      save();

      await message.reply(
        "🔒 Ticket kapatılıyor..."
      );

      return message.channel
        .delete()
        .catch(() => {});
    }

    /* =====================================================
       KICK
       ===================================================== */

    if (command === "kick") {
      if (!isAdmin(message)) {
        return message.reply(
          "❌ Yönetici gerekli."
        );
      }

      if (!target) {
        return message.reply(
          "❌ Oyuncu etiketle."
        );
      }

      await target
        .kick(
          args
            .slice(1)
            .join(" ") ||
            "United League"
        )
        .catch(() => {});

      return message.reply(
        `👢 ${target} sunucudan atıldı.`
      );
    }

    /* =====================================================
       BAN
       ===================================================== */

    if (command === "ban") {
      if (!isAdmin(message)) {
        return message.reply(
          "❌ Yönetici gerekli."
        );
      }

      if (!target) {
        return message.reply(
          "❌ Oyuncu etiketle."
        );
      }

      await target
        .ban({
          reason:
            args
              .slice(1)
              .join(" ") ||
            "United League"
        })
        .catch(() => {});

      return message.reply(
        `🔨 ${target} banlandı.`
      );
    }

    /* =====================================================
       MUTE
       ===================================================== */

    if (command === "mute") {
      if (!isAdmin(message)) {
        return message.reply(
          "❌ Yönetici gerekli."
        );
      }

      if (!target) {
        return message.reply(
          "❌ Oyuncu etiketle."
        );
      }

      let muteRole =
        message.guild.roles.cache.find(
          role =>
            role.name.toLowerCase() ===
            "mute"
        );

      if (!muteRole) {
        muteRole =
          await message.guild.roles.create(
            {
              name: "Mute",
              color: 0x808080
            }
          ).catch(() => null);
      }

      if (muteRole) {
        await target.roles
          .add(muteRole)
          .catch(() => {});
      }

      return message.reply(
        `🔇 ${target} susturuldu.`
      );
    }

    /* =====================================================
       UNMUTE
       ===================================================== */

    if (
      command ===
      "unmute"
    ) {
      if (!isAdmin(message)) {
        return message.reply(
          "❌ Yönetici gerekli."
        );
      }

      if (!target) {
        return message.reply(
          "❌ Oyuncu etiketle."
        );
      }

      const muteRole =
        message.guild.roles.cache.find(
          role =>
            role.name.toLowerCase() ===
            "mute"
        );

      if (muteRole) {
        await target.roles
          .remove(muteRole)
          .catch(() => {});
      }

      return message.reply(
        `🔊 ${target} susturması kaldırıldı.`
      );
    }

    /* =====================================================
       MESAJ SİL
       ===================================================== */

    if (command === "sil") {
      if (!isAdmin(message)) {
        return message.reply(
          "❌ Yönetici gerekli."
        );
      }

      let amount =
        parseInt(args[0]);

      if (
        !Number.isFinite(
          amount
        ) ||
        amount < 1
      ) {
        return message.reply(
          "❌ Geçerli miktar yaz."
        );
      }

      amount =
        Math.min(
          amount,
          1000
        );

      let deleted = 0;

      for (
        let i = 0;
        i < 10 &&
        deleted < amount;
        i++
      ) {
        const batch =
          await message.channel
            .bulkDelete(
              Math.min(
                100,
                amount -
                  deleted
              ),
              true
            )
            .catch(
              () => null
            );

        if (
          !batch ||
          batch.size === 0
        ) {
          break;
        }

        deleted +=
          batch.size;

        if (
          batch.size < 100
        ) {
          break;
        }
      }

      return message.channel
        .send(
          `🗑️ **${deleted}** mesaj silindi.`
        )
        .then(msg => {
          setTimeout(
            () =>
              msg
                .delete()
                .catch(
                  () => {}
                ),
            3000
          );
        });
    }

    /* =====================================================
       KİLİT
       ===================================================== */

    if (
      command ===
      "kilitle"
    ) {
      if (!isAdmin(message)) {
        return message.reply(
          "❌ Yönetici gerekli."
        );
      }

      await message.channel
        .permissionOverwrites
        .edit(
          message.guild.roles.everyone,
          {
            SendMessages:
              false
          }
        )
        .catch(() => {});

      return message.reply(
        "🔒 Kanal kilitlendi."
      );
    }

    if (
      command ===
        "kilitaç" ||
      command ===
        "kilitac"
    ) {
      if (!isAdmin(message)) {
        return message.reply(
          "❌ Yönetici gerekli."
        );
      }

      await message.channel
        .permissionOverwrites
        .edit(
          message.guild.roles.everyone,
          {
            SendMessages:
              null
          }
        )
        .catch(() => {});

      return message.reply(
        "🔓 Kanal açıldı."
      );
    }

    /* =====================================================
       ÇEKİLİŞ
       ===================================================== */

    if (
      command ===
        "çekiliş" ||
      command ===
        "cekilis"
    ) {
      if (!isAdmin(message)) {
        return message.reply(
          "❌ Çekiliş Yetkilisi/Yönetici gerekli."
        );
      }

      if (
        !args[0] ||
        !args[1]
      ) {
        return message.reply(
          "❌ Örnek: `.çekiliş 5M€ 5sa`"
        );
      }

      const duration =
        parseDuration(
          args[1]
        );

      if (
        !Number.isFinite(
          duration
        )
      ) {
        return message.reply(
          "❌ Süre: `30sn`, `5dk`, `2sa` şeklinde olmalı."
        );
      }

      const id =
        Date.now().toString();

      const giveaway = {
        id,
        prize:
          args[0],
        duration,
        channelId:
          message.channel.id,
        entries: [],
        ended: false,
        endAt:
          Date.now() +
          duration
      };

      db.giveaways.push(
        giveaway
      );

      save();

      const row =
        new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(
                `giveaway:${id}`
              )
              .setLabel(
                "🎁 Katıl"
              )
              .setStyle(
                ButtonStyle.Success
              )
          );

      await message.channel.send({
        embeds: [
          makeEmbed(
            "🎁 ÇEKİLİŞ BAŞLADI",
            `💰 **Ödül:** ${
              args[0]
            }

⏱️ **Süre:** ${
              args[1]
            }

👥 **Katılımcı:** 0`
          )
        ],
        components: [row]
      });

      setTimeout(
        async () => {
          if (
            giveaway.ended
          ) {
            return;
          }

          giveaway.ended =
            true;

          const winner =
            giveaway.entries[
              Math.floor(
                Math.random() *
                  giveaway.entries
                    .length
              )
            ];

          if (winner) {
            message.channel.send({
              embeds: [
                makeEmbed(
                  "🎉 ÇEKİLİŞ BİTTİ",
                  `💰 **Ödül:** ${
                    giveaway.prize
                  }

🏆 **Kazanan:** <@${winner}>`
                )
              ]
            }).catch(() => {});
          } else {
            message.channel.send(
              "🎁 Çekiliş bitti ancak katılımcı yoktu."
            ).catch(() => {});
          }

          save();
        },
        duration
      );

      return;
    }

    /* =====================================================
       YENİ KAZANAN
       ===================================================== */

    if (
      command ===
      "yenikazanan"
    ) {
      if (!isAdmin(message)) {
        return message.reply(
          "❌ Yönetici gerekli."
        );
      }

      const giveaway =
        [...db.giveaways]
          .reverse()
          .find(
            x =>
              x.ended &&
              x.entries.length
          );

      if (!giveaway) {
        return message.reply(
          "❌ Uygun çekiliş yok."
        );
      }

      const winner =
        giveaway.entries[
          Math.floor(
            Math.random() *
              giveaway.entries
                .length
          )
        ];

      return message.reply(
        `🎉 Yeni kazanan: <@${winner}>`
      );
    }

    /* =====================================================
       TWEET / HABER
       ===================================================== */

    if (
      command === "tweet" ||
      command === "haber"
    ) {
      const text =
        args.join(" ");

      const attachment =
        message.attachments.first();

      if (
        !text &&
        !attachment
      ) {
        return message.reply(
          "❌ Mesaj veya görsel ekle."
        );
      }

      const e =
        makeEmbed(
          command ===
            "tweet"
            ? "🐦 UNITED LEAGUE TWEET"
            : "📰 UNITED LEAGUE HABER",
          text ||
            "Yeni medya paylaşımı."
        );

      if (
        attachment &&
        attachment.contentType?.startsWith(
          "image/"
        )
      ) {
        e.setImage(
          attachment.url
        );
      }

      return message.channel.send({
        embeds: [e]
      });
    }

    /* =====================================================
       DM
       ===================================================== */

    if (command === "dm") {
      if (!isAdmin(message)) {
        return message.reply(
          "❌ DM/SM Yetkilisi veya Yönetici gerekli."
        );
      }

      const destination =
        args.shift();

      const text =
        args.join(" ");

      if (
        !destination ||
        !text
      ) {
        return message.reply(
          "❌ Kullanım: `.dm all Mesaj` veya `.dm @oyuncu Mesaj`"
        );
      }

      const dmEmbed =
        new EmbedBuilder()
          .setTitle(
            "⚽ United League"
          )
          .setDescription(
            text
          )
          .setColor(
            0x5865f2
          )
          .setFooter({
            text:
              "United League • Resmî Bildirim"
          })
          .setTimestamp();

      if (
        destination.toLowerCase() ===
        "all"
      ) {
        await message.guild.members
          .fetch()
          .catch(() => {});

        let sent = 0;

        for (
          const member of
            message.guild.members
              .cache.values()
        ) {
          if (
            member.user.bot
          ) {
            continue;
          }

          await member.user
            .send({
              embeds: [
                dmEmbed
              ]
            })
            .then(
              () =>
                sent++
            )
            .catch(
              () => {}
            );
        }

        return message.reply(
          `📩 DM gönderimi tamamlandı.

✅ Gönderilen: **${sent}**`
        );
      }

      if (!target) {
        return message.reply(
          "❌ Oyuncu etiketle."
        );
      }

      await target.user
        .send({
          embeds: [
            dmEmbed
          ]
        })
        .catch(() => {});

      return message.reply(
        `📩 ${target} kişisine DM gönderildi.`
      );
    }

    /* =====================================================
       ŞİRKETLER
       ===================================================== */

    if (
      command ===
        "şirketler" ||
      command ===
        "sirketler"
    ) {
      const list =
        Object.entries(
          BRANDS
        )
          .map(
            ([name, data]) =>
              `🏢 **${name}**
Şirket kabul: **%${data.companyChance}**
Sponsor kabul: **%${data.sponsorChance}**
💰 Bütçe: **${money(
                data.budget
              )}**`
          )
          .join("\n\n");

      return message.reply({
        embeds: [
          makeEmbed(
            "🏢 NPC ŞİRKETLER",
            list
          )
        ]
      });
    }

    /* =====================================================
       ŞİRKET BAŞVURU
       ===================================================== */

    if (
      command ===
        "şirketbaşvur" ||
      command ===
        "sirketbasvur"
    ) {
      const brand =
        args.join(" ");

      const data =
        BRANDS[brand];

      if (!data) {
        return message.reply(
          `❌ Marka bulunamadı.

${Object.keys(
            BRANDS
          ).join(", ")}`
        );
      }

      const accepted =
        Math.random() *
          100 <
        data.companyChance;

      db.companies[
        message.author.id
      ] = {
        brand,
        accepted,
        date:
          Date.now()
      };

      save();

      return message.reply(
        accepted
          ? `🏢 **${brand}** şirket başvurun **KABUL EDİLDİ!**`
          : `🏢 **${brand}** şirket başvurun **REDDEDİLDİ.**`
      );
    }

    if (
      command ===
        "şirketbaşvurularım" ||
      command ===
        "sirketbasvurularim"
    ) {
      const data =
        db.companies[
          message.author.id
        ];

      if (!data) {
        return message.reply(
          "❌ Şirket başvurun yok."
        );
      }

      return message.reply(
        `🏢 Marka: **${data.brand}**
📋 Durum: **${
          data.accepted
            ? "Kabul"
            : "Red"
        }**`
      );
    }

    /* =====================================================
       SPONSORLAR
       ===================================================== */

    if (
      command ===
      "sponsorlar"
    ) {
      const list =
        Object.entries(
          BRANDS
        )
          .map(
            ([name, data]) =>
              `🤝 **${name}** — Sponsor kabul şansı: **%${data.sponsorChance}**`
          )
          .join("\n");

      return message.reply({
        embeds: [
          makeEmbed(
            "🤝 NPC SPONSORLAR",
            list
          )
        ]
      });
    }

    if (
      command ===
        "sponsorbaşvur" ||
      command ===
        "sponsorbasvur"
    ) {
      const brand =
        args.join(" ");

      const data =
        BRANDS[brand];

      if (!data) {
        return message.reply(
          `❌ Marka bulunamadı.

${Object.keys(
            BRANDS
          ).join(", ")}`
        );
      }

      const accepted =
        Math.random() *
          100 <
        data.sponsorChance;

      db.sponsors[
        message.author.id
      ] = {
        brand,
        accepted,
        date:
          Date.now()
      };

      save();

      return message.reply(
        accepted
          ? `🤝 **${brand}** sponsor başvurun **KABUL EDİLDİ!**`
          : `🤝 **${brand}** sponsor başvurun **REDDEDİLDİ.**`
      );
    }

    if (
      command ===
        "sponsorlarım" ||
      command ===
        "sponsorlarim"
    ) {
      const data =
        db.sponsors[
          message.author.id
        ];

      if (!data) {
        return message.reply(
          "❌ Sponsor başvurun yok."
        );
      }

      return message.reply(
        `🤝 Marka: **${data.brand}**
📋 Durum: **${
          data.accepted
            ? "Kabul"
            : "Red"
        }**`
      );
    }

    /* =====================================================
       REKLAM
       ===================================================== */

    if (
      command ===
      "reklam"
    ) {
      return message.reply({
        embeds: [
          makeEmbed(
            "📢 UNITED LEAGUE REKLAM PAKETLERİ",
            `🥉 **Bronz:** 150K
🥈 **Gümüş:** 300K
🥇 **Altın:** 600K
💎 **Platin:** 1.2M
👑 **Legendary:** 2.4M
🌟 **Ultimate:** 4.8M

📢 **@everyone:** 100K
📢 **@here:** 50K

🎟️ Her paket: 1 reklam hakkı
⭐ 600K sonrası haklar artırılır
🔒 Maksimum @everyone/@here hakkı: 5
📺 700K sonrası özel reklam kanalı sistemi`
          )
        ]
      });
    }

    /* =====================================================
       YARDIM
       ===================================================== */

    if (
      command ===
        "yardım" ||
      command ===
        "yardim" ||
      command ===
        "help"
    ) {
      return message.reply({
        embeds: [
          makeEmbed(
            "📚 UNITED LEAGUE — TÜM KOMUTLAR",
            `🏓 **Ping**
\`.ping\`

📝 **Kayıt**
\`.kayıt\`
\`.k @oyuncu\`

👤 **Profil**
\`.profil @oyuncu\`
\`.istatistik @oyuncu\`

💰 **Değer**
\`.dver @oyuncu 5M\`
\`.değer @oyuncu\`
\`.değerler\`

🏋️ **Antrenman**
\`.ant\`
\`.antrenman\`

🥅 **Penaltı**
\`.pen\`
\`.penaltı\`

💵 **Bütçe**
\`.bütçe\`
\`.bütçe @oyuncu\`
\`.para @oyuncu 5M\`
\`.paragönder @oyuncu 5M\`

🏟️ **Takım**
\`.takımoluştur Takım\`
\`.takım\`
\`.takımım\`
\`.takımlar\`

💰 **Takım Bütçesi**
\`.takımbütçe\`
\`.takımpara 5M\`
\`.takımharca 5M\`
\`.takımbütçegönder @Takım 5M\`

👥 **Kadro**
\`.kadro\`
\`.kadro @oyuncu\`
\`.kadrocikar @oyuncu\`

📋 **Formasyon**
\`.formasyon\`
\`.formasyon 4-3-3\`
\`.pozisyon @oyuncu ST\`

🔄 **Transfer**
\`.transfer @oyuncu Takım 10M\`
\`.transferler\`
\`.transfergeçmişi\`

⚽ **Maç**
\`.maç @takım1 @takım2\`
\`.maçlar\`
\`.maçsonucu\`

🏆 **Lig**
\`.lig\`
\`.puan\`
\`.golkrallığı\`
\`.asistkrallığı\`
\`.sezon\`

🎫 **Ticket**
\`.ticket\`
\`.ticketkapat\`

🛡️ **Moderasyon**
\`.kick @oyuncu\`
\`.ban @oyuncu\`
\`.mute @oyuncu\`
\`.unmute @oyuncu\`
\`.sil 100\`
\`.kilitle\`
\`.kilitaç\`

🎁 **Çekiliş**
\`.çekiliş 5M€ 5sa\`
\`.yenikazanan\`

🐦 **Medya**
\`.tweet Mesaj\`
\`.haber Mesaj\`

📩 **DM**
\`.dm all Mesaj\`
\`.dm @oyuncu Mesaj\`

🏢 **Şirket**
\`.şirketler\`
\`.şirketbaşvur Adidas\`
\`.şirketbaşvurularım\`

🤝 **Sponsor**
\`.sponsorlar\`
\`.sponsorbaşvur Nike\`
\`.sponsorlarım\`

📢 **Reklam**
\`.reklam\`

❌ **Sunucu profili komutu yoktur.**`
          )
        ]
      });
    }

  } catch (error) {
    console.error(
      "❌ Komut hatası:",
      error
    );

    if (!message.replied) {
      message.reply(
        "❌ İşlem sırasında bir hata oluştu."
      ).catch(() => {});
    }
  }
});

/* =========================================================
   TOKEN
   ========================================================= */

if (!TOKEN) {
  console.error(
    "❌ TOKEN bulunamadı!"
  );

  console.error(
    "Railway > Variables > TOKEN ekle."
  );

  process.exit(1);
}

client.login(TOKEN);
