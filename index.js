// index.js
require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType
} = require("discord.js");

const Database = require("better-sqlite3");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

const PREFIX = ".";

// =========================
// VERİTABANI
// =========================

const db = new Database("footballrp.db");

db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS config (
  guild_id TEXT PRIMARY KEY,
  training_channel TEXT,
  penalty_channel TEXT,
  registration_channel TEXT,
  log_channel TEXT,
  match_role TEXT,
  announcement_role TEXT,
  partner_role TEXT,
  transfer_role TEXT
);

CREATE TABLE IF NOT EXISTS players (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  position TEXT DEFAULT 'SNT',
  country TEXT DEFAULT '🌍',
  number INTEGER DEFAULT 0,
  club_id TEXT,
  value REAL DEFAULT 0,
  salary REAL DEFAULT 0,
  balance REAL DEFAULT 0,
  ovr INTEGER DEFAULT 60,
  pot INTEGER DEFAULT 75,
  form INTEGER DEFAULT 50,
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  training_progress INTEGER DEFAULT 0,
  training_count INTEGER DEFAULT 0,
  penalty_attempts INTEGER DEFAULT 0,
  penalty_goals INTEGER DEFAULT 0,
  goals INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  yellow INTEGER DEFAULT 0,
  red INTEGER DEFAULT 0,
  mvp INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  draws INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  PRIMARY KEY (guild_id,user_id)
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT,
  user_id TEXT,
  club_id TEXT,
  type TEXT,
  amount REAL DEFAULT 0,
  description TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS mine_stats (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  games INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  best_score INTEGER DEFAULT 0,
  total_score INTEGER DEFAULT 0,
  PRIMARY KEY(guild_id,user_id)
);

CREATE TABLE IF NOT EXISTS clubs (
  guild_id TEXT NOT NULL,
  club_id TEXT NOT NULL,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  president_id TEXT,
  td_id TEXT,
  cash REAL DEFAULT 0,
  transfer_budget REAL DEFAULT 0,
  salary_budget REAL DEFAULT 0,
  PRIMARY KEY(guild_id,club_id)
);
`);

// =========================
// ROLLER
// =========================

const ROLE_IDS = {
  ADMIN: process.env.ADMIN_ROLE_ID || "1544449436011339806",
  REGISTER: process.env.REGISTER_ROLE_ID || "1544452022764568656",
  VALUE: process.env.VALUE_ROLE_ID || "1544451743746891806"
};

// =========================
// AKTİF OYUNLAR
// =========================

const activeMines = new Map();

// =========================
// PARA
// =========================

function money(value) {
  value = Number(value) || 0;

  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000)
      .toFixed(2)
      .replace(/\.00$/, "")}B€`;
  }

  if (value >= 1_000_000) {
    return `${(value / 1_000_000)
      .toFixed(2)
      .replace(/\.00$/, "")}M€`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000)
      .toFixed(2)
      .replace(/\.00$/, "")}K€`;
  }

  return `${Math.round(value).toLocaleString("tr-TR")}€`;
}

function parseMoney(input) {
  if (!input) return NaN;

  let value = String(input)
    .toUpperCase()
    .replace(/€/g, "")
    .replace(/\s/g, "")
    .replace(",", ".");

  let multiplier = 1;

  if (value.endsWith("B")) {
    multiplier = 1_000_000_000;
    value = value.slice(0, -1);
  } else if (value.endsWith("M")) {
    multiplier = 1_000_000;
    value = value.slice(0, -1);
  } else if (value.endsWith("K")) {
    multiplier = 1_000;
    value = value.slice(0, -1);
  }

  const number = Number(value);

  if (!Number.isFinite(number)) return NaN;

  return number * multiplier;
}

// =========================
// YARDIMCI
// =========================

function isAdmin(member) {
  return (
    member.permissions.has(
      PermissionsBitField.Flags.Administrator
    ) ||
    member.roles.cache.has(ROLE_IDS.ADMIN)
  );
}

function getConfig(guildId) {
  let config = db
    .prepare("SELECT * FROM config WHERE guild_id=?")
    .get(guildId);

  if (!config) {
    db.prepare(
      "INSERT INTO config (guild_id) VALUES (?)"
    ).run(guildId);

    config = db
      .prepare("SELECT * FROM config WHERE guild_id=?")
      .get(guildId);
  }

  return config;
}

function getPlayer(guildId, userId) {
  return db
    .prepare(
      "SELECT * FROM players WHERE guild_id=? AND user_id=?"
    )
    .get(guildId, userId);
}

function ensurePlayer(guildId, userId, name) {
  let player = getPlayer(guildId, userId);

  if (!player) {
    db.prepare(`
      INSERT INTO players
      (guild_id,user_id,name)
      VALUES (?,?,?)
    `).run(
      guildId,
      userId,
      name || "Futbolcu"
    );

    player = getPlayer(guildId, userId);
  }

  return player;
}

function addTransaction(
  guildId,
  userId,
  type,
  amount,
  description
) {
  db.prepare(`
    INSERT INTO transactions
    (guild_id,user_id,type,amount,description)
    VALUES (?,?,?,?,?)
  `).run(
    guildId,
    userId || null,
    type,
    amount || 0,
    description || ""
  );
}

function addXP(guildId, userId, amount) {
  const player = ensurePlayer(
    guildId,
    userId
  );

  let xp = player.xp + amount;
  let level = player.level;

  while (xp >= level * 100) {
    xp -= level * 100;
    level++;
  }

  db.prepare(`
    UPDATE players
    SET xp=?, level=?
    WHERE guild_id=? AND user_id=?
  `).run(
    xp,
    level,
    guildId,
    userId
  );
}

function updateOVR(guildId, userId, amount) {
  const player = ensurePlayer(
    guildId,
    userId
  );

  const newOVR = Math.max(
    1,
    Math.min(
      player.pot,
      player.ovr + amount
    )
  );

  db.prepare(`
    UPDATE players
    SET ovr=?
    WHERE guild_id=? AND user_id=?
  `).run(
    newOVR,
    guildId,
    userId
  );
}

// =========================
// DEĞER DEĞİŞTİRME
// =========================

async function changeValue(
  guild,
  user,
  amount,
  type
) {
  const player = ensurePlayer(
    guild.id,
    user.id,
    user.username
  );

  const oldValue = player.value;

  const newValue = Math.max(
    0,
    oldValue + amount
  );

  db.prepare(`
    UPDATE players
    SET value=?
    WHERE guild_id=? AND user_id=?
  `).run(
    newValue,
    guild.id,
    user.id
  );

  addTransaction(
    guild.id,
    user.id,
    type,
    amount,
    `Değer: ${money(oldValue)} → ${money(newValue)}`
  );

  const member = await guild.members
    .fetch(user.id)
    .catch(() => null);

  if (
    member &&
    guild.members.me &&
    guild.members.me.permissions.has(
      PermissionsBitField.Flags.ManageNicknames
    )
  ) {
    const oldNick =
      member.nickname ||
      member.user.username;

    const parts = oldNick
      .split("|")
      .map(x => x.trim());

    if (parts.length >= 4) {
      parts[parts.length - 1] =
        money(newValue);

      await member
        .setNickname(
          parts.join(" | ").slice(0, 32)
        )
        .catch(() => {});
    }
  }

  return newValue;
}

// =========================
// ANRENMAN
// =========================

async function training(message) {
  const config = getConfig(
    message.guild.id
  );

  if (
    config.training_channel &&
    config.training_channel !== message.channel.id
  ) {
    return message.reply(
      "❌ Bu komut sadece **antrenman kanalında** kullanılabilir."
    );
  }

  const player = ensurePlayer(
    message.guild.id,
    message.author.id,
    message.author.username
  );

  let progress =
    player.training_progress + 1;

  if (progress >= 10) {
    progress = 0;

    await changeValue(
      message.guild,
      message.author,
      3_000_000,
      "TRAINING"
    );

    updateOVR(
      message.guild.id,
      message.author.id,
      1
    );

    addXP(
      message.guild.id,
      message.author.id,
      50
    );

    db.prepare(`
      UPDATE players
      SET training_progress=?,
          training_count=training_count+1,
          form=MIN(100,form+2)
      WHERE guild_id=? AND user_id=?
    `).run(
      progress,
      message.guild.id,
      message.author.id
    );

    return message.reply(
      `🏋️ **ANTRENMAN 10/10 TAMAMLANDI!**\n\n` +
      `💰 Piyasa değeri: **+3M€**\n` +
      `⭐ OVR gelişti\n` +
      `✨ XP kazanıldı\n\n` +
      `🔄 Yeni antrenman serisi başladı: **0/10**`
    );
  }

  db.prepare(`
    UPDATE players
    SET training_progress=?,
        training_count=training_count+1,
        form=MIN(100,form+1)
    WHERE guild_id=? AND user_id=?
  `).run(
    progress,
    message.guild.id,
    message.author.id
  );

  addXP(
    message.guild.id,
    message.author.id,
    10
  );

  return message.reply(
    `🏋️ **Antrenman tamamlandı!**\n\n` +
    `📈 İlerleme: **${progress}/10**\n` +
    `⭐ OVR: **${getPlayer(
      message.guild.id,
      message.author.id
    ).ovr}**`
  );
}

// =========================
// PENALTI
// =========================

async function penalty(message) {
  const config = getConfig(
    message.guild.id
  );

  if (
    config.penalty_channel &&
    config.penalty_channel !== message.channel.id
  ) {
    return message.reply(
      "❌ Bu komut sadece **penaltı kanalında** kullanılabilir."
    );
  }

  const player = ensurePlayer(
    message.guild.id,
    message.author.id,
    message.author.username
  );

  const goal =
    Math.random() < 0.65;

  db.prepare(`
    UPDATE players
    SET penalty_attempts=penalty_attempts+1,
        penalty_goals=penalty_goals+?,
        form=MAX(0,MIN(100,form+?))
    WHERE guild_id=? AND user_id=?
  `).run(
    goal ? 1 : 0,
    goal ? 1 : -1,
    message.guild.id,
    message.author.id
  );

  if (goal) {
    await changeValue(
      message.guild,
      message.author,
      2_000_000,
      "PENALTY_GOAL"
    );

    addXP(
      message.guild.id,
      message.author.id,
      25
    );

    updateOVR(
      message.guild.id,
      message.author.id,
      1
    );

    const updated =
      getPlayer(
        message.guild.id,
        message.author.id
      );

    return message.reply(
      `🥅 **GOOOL! ⚽**\n\n` +
      `💰 Piyasa değeri: **+2M€**\n` +
      `💎 Yeni değer: **${money(updated.value)}**\n` +
      `📊 Penaltı: **${updated.penalty_goals}/${updated.penalty_attempts}**`
    );
  }

  const updated =
    getPlayer(
      message.guild.id,
      message.author.id
    );

  return message.reply(
    `🧤 **KALECİ KURTARDI!**\n\n` +
    `❌ Penaltı kaçtı.\n` +
    `📊 Penaltı: **${updated.penalty_goals}/${updated.penalty_attempts}**`
  );
}

// =========================
// MINE 3x3
// BAHİSSİZ / ÖDÜLSÜZ
// =========================

function createMineGame(
  guildId,
  userId,
  bombs
) {
  const positions =
    [...Array(9).keys()];

  for (
    let i = positions.length - 1;
    i > 0;
    i--
  ) {
    const j =
      Math.floor(
        Math.random() * (i + 1)
      );

    [
      positions[i],
      positions[j]
    ] = [
      positions[j],
      positions[i]
    ];
  }

  const minePositions =
    new Set(
      positions.slice(0, bombs)
    );

  return {
    guildId,
    userId,
    bombs,
    score: 0,
    ended: false,
    cells: [...Array(9)].map(
      (_, index) => ({
        mine: minePositions.has(index),
        open: false
      })
    )
  };
}

function mineComponents(game) {
  const rows = [];

  for (let r = 0; r < 3; r++) {
    const row =
      new ActionRowBuilder();

    for (let c = 0; c < 3; c++) {
      const index =
        r * 3 + c;

      const cell =
        game.cells[index];

      let label = "⬜";
      let style =
        ButtonStyle.Secondary;

      if (cell.open) {
        label =
          cell.mine
            ? "💣"
            : "🟩";

        style =
          cell.mine
            ? ButtonStyle.Danger
            : ButtonStyle.Success;
      }

      row.addComponents(
        new ButtonBuilder()
          .setCustomId(
            `mine:${game.userId}:${index}`
          )
          .setLabel(label)
          .setStyle(style)
          .setDisabled(
            cell.open ||
            game.ended
          )
      );
    }

    rows.push(row);
  }

  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(
          `mine:new:${game.userId}`
        )
        .setLabel("🔄 Yeni Oyun")
        .setStyle(
          ButtonStyle.Primary
        ),

      new ButtonBuilder()
        .setCustomId(
          `mine:end:${game.userId}`
        )
        .setLabel("🛑 Oyunu Bitir")
        .setStyle(
          ButtonStyle.Danger
        )
    )
  );

  return rows;
}

function mineEmbed(
  game,
  finished = false
) {
  const safeOpened =
    game.cells.filter(
      cell =>
        cell.open &&
        !cell.mine
    ).length;

  return new EmbedBuilder()
    .setColor(
      finished
        ? 0xed4245
        : 0x57f287
    )
    .setTitle(
      finished
        ? "💥 MAYIN TARLASI"
        : "💣 MAYIN TARLASI"
    )
    .setDescription(
      `👤 Oyuncu: <@${game.userId}>\n` +
      `💣 Bomba: **${game.bombs}**\n` +
      `✅ Güvenli kare: **${safeOpened}**\n` +
      `⭐ Skor: **${game.score}**`
    )
    .setFooter({
      text:
        "3×3 • Bahissiz • Para ödülü yok"
    });
}

async function startMine(
  message,
  bombs
) {
  const key =
    `${message.guild.id}:${message.author.id}`;

  if (activeMines.has(key)) {
    return message.reply(
      "❌ Zaten aktif bir `.mine` oyunun var."
    );
  }

  bombs = Number(bombs || 2);

  if (
    !Number.isInteger(bombs) ||
    bombs < 1 ||
    bombs > 8
  ) {
    return message.reply(
      "❌ Bomba sayısı **1-8** arasında olmalı.\nÖrnek: `.mine 3`"
    );
  }

  const game =
    createMineGame(
      message.guild.id,
      message.author.id,
      bombs
    );

  activeMines.set(
    key,
    game
  );

  const sent =
    await message.reply({
      embeds: [
        mineEmbed(game)
      ],
      components:
        mineComponents(game)
    });

  game.messageId =
    sent.id;

  db.prepare(`
    INSERT INTO mine_stats
    (guild_id,user_id,games)
    VALUES (?,?,1)
    ON CONFLICT(guild_id,user_id)
    DO UPDATE SET games=games+1
  `).run(
    message.guild.id,
    message.author.id
  );
}

// =========================
// BUTTONLAR
// =========================

client.on(
  "interactionCreate",
  async interaction => {
    if (!interaction.isButton())
      return;

    // =====================
    // MINE
    // =====================

    if (
      interaction.customId
        .startsWith("mine:")
    ) {
      const parts =
        interaction.customId
          .split(":");

      const action =
        parts[1];

      const owner =
        parts[2];

      if (
        interaction.user.id !== owner
      ) {
        return interaction.reply({
          content:
            "❌ Bu oyun sana ait değil.",
          ephemeral: true
        });
      }

      const key =
        `${interaction.guild.id}:${owner}`;

      if (
        action === "new"
      ) {
        activeMines.delete(key);

        const game =
          createMineGame(
            interaction.guild.id,
            owner,
            2
          );

        activeMines.set(
          key,
          game
        );

        await interaction.update({
          embeds: [
            mineEmbed(game)
          ],
          components:
            mineComponents(game)
        });

        game.messageId =
          interaction.message.id;

        return;
      }

      if (
        action === "end"
      ) {
        activeMines.delete(key);

        return interaction.update({
          embeds: [
            new EmbedBuilder()
              .setColor(0xed4245)
              .setTitle(
                "🛑 OYUN BİTİRİLDİ"
              )
              .setDescription(
                "Mayın tarlası oyuncu tarafından sonlandırıldı."
              )
          ],
          components: []
        });
      }

      const index =
        Number(parts[2]);

      // Format mine:user:index için doğru ayrıştırma
      const actualIndex =
        Number(parts[2]);

      const game =
        activeMines.get(key);

      if (
        !game ||
        game.messageId !==
          interaction.message.id
      ) {
        return interaction.reply({
          content:
            "❌ Bu oyun artık aktif değil.",
          ephemeral: true
        });
      }

      const cell =
        game.cells[actualIndex];

      if (!cell || cell.open) {
        return interaction.deferUpdate();
      }

      cell.open = true;

      if (cell.mine) {
        for (
          const item of game.cells
        ) {
          if (item.mine)
            item.open = true;
        }

        game.ended = true;

        db.prepare(`
          UPDATE mine_stats
          SET losses=losses+1
          WHERE guild_id=? AND user_id=?
        `).run(
          interaction.guild.id,
          owner
        );

        activeMines.delete(key);

        return interaction.update({
          embeds: [
            mineEmbed(
              game,
              true
            )
          ],
          components:
            mineComponents(game)
        });
      }

      game.score += 50;

      addXP(
        interaction.guild.id,
        owner,
        10
      );

      const safeTotal =
        game.cells.filter(
          x => !x.mine
        ).length;

      const safeOpened =
        game.cells.filter(
          x =>
            x.open &&
            !x.mine
        ).length;

      if (
        safeOpened >= safeTotal
      ) {
        game.ended = true;

        db.prepare(`
          UPDATE mine_stats
          SET wins=wins+1,
              total_score=total_score+?,
              best_score=MAX(best_score,?)
          WHERE guild_id=? AND user_id=?
        `).run(
          game.score,
          game.score,
          interaction.guild.id,
          owner
        );

        activeMines.delete(key);

        return interaction.update({
          embeds: [
            mineEmbed(
              game,
              true
            ).setTitle(
              "🏆 MAYIN TARLASI TAMAMLANDI!"
            )
          ],
          components:
            mineComponents(game)
        });
      }

      return interaction.update({
        embeds: [
          mineEmbed(game)
        ],
        components:
          mineComponents(game)
      });
    }

    // =====================
    // ROL PANELİ
    // =====================

    if (
      interaction.customId
        .startsWith("role:")
    ) {
      const config =
        getConfig(
          interaction.guild.id
        );

      const roles = {
        match:
          config.match_role,

        announcement:
          config.announcement_role,

        partner:
          config.partner_role,

        transfer:
          config.transfer_role
      };

      const action =
        interaction.customId
          .split(":")[1];

      if (action === "list") {
        const active =
          Object.entries(roles)
            .filter(
              ([, id]) =>
                id &&
                interaction.member
                  .roles.cache
                  .has(id)
            )
            .map(
              ([name]) =>
                name
            );

        return interaction.reply({
          content:
            active.length
              ? `📋 Aktif rollerin: **${active.join(", ")}**`
              : "📋 Aktif bildirim rolün yok.",
          ephemeral: true
        });
      }

      if (
        action === "close"
      ) {
        for (
          const id of
          Object.values(roles)
        ) {
          if (
            id &&
            interaction.member
              .roles.cache
              .has(id)
          ) {
            await interaction.member
              .roles.remove(id)
              .catch(() => {});
          }
        }

        return interaction.reply({
          content:
            "❌ Tüm bildirim rollerin kaldırıldı.",
          ephemeral: true
        });
      }

      const roleId =
        roles[action];

      if (!roleId) {
        return interaction.reply({
          content:
            "❌ Bu bildirim rolü bulunamadı.",
          ephemeral: true
        });
      }

      if (
        interaction.member
          .roles.cache
          .has(roleId)
      ) {
        await interaction.member
          .roles.remove(roleId);

        return interaction.reply({
          content:
            "🔕 Bildirim rolü kaldırıldı.",
          ephemeral: true
        });
      }

      await interaction.member
        .roles.add(roleId);

      return interaction.reply({
        content:
          "🔔 Bildirim rolü eklendi.",
        ephemeral: true
      });
    }
  }
);

// =========================
// YENİ ÜYE
// =========================

client.on(
  "guildMemberAdd",
  async member => {
    const config =
      getConfig(
        member.guild.id
      );

    if (
      config.registration_channel
    ) {
      const channel =
        member.guild.channels.cache.get(
          config.registration_channel
        );

      if (channel) {
        await channel.send(
          `👋 Hoş geldin ${member}!\n` +
          `📝 Kayıt olmak için yetkiliyle iletişime geç.\n` +
          `Yetkili: <@&${ROLE_IDS.REGISTER}>`
        ).catch(() => {});
      }
    }
  }
);

// =========================
// MESAJ KOMUTLARI
// =========================

client.on(
  "messageCreate",
  async message => {
    if (
      message.author.bot ||
      !message.guild ||
      !message.content.startsWith(PREFIX)
    ) return;

    const args =
      message.content
        .slice(PREFIX.length)
        .trim()
        .split(/\s+/);

    const command =
      (args.shift() || "")
        .toLowerCase();

    try {

      // ====================
      // YARDIM
      // ====================

      if (
        command === "yardım" ||
        command === "help" ||
        command === "h"
      ) {
        return message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x5865f2)
              .setTitle(
                "⚽ FOOTBALL RP BOT"
              )
              .setDescription(
                [
                  "### 👤 Oyuncu",
                  "`.profil`",
                  "`.ara futbolcu isim`",
                  "`.değerler`",

                  "",
                  "### 🏋️ Gelişim",
                  "`.antrenman` / `.ant`",
                  "`.pen` / `.penaltı`",

                  "",
                  "### 💰 Değer",
                  "`.dver @oyuncu 5M`",
                  "`.dsil @oyuncu 2M`",

                  "",
                  "### 💣 Mini Oyun",
                  "`.mine 2`",
                  "`.mineistatistik`",

                  "",
                  "### 🛡️ Yönetim",
                  "`.rolver`",
                  "`.rolal`",
                  "`.rolpanel`",
                  "`.sunucukur`",
                  "`.sil`",
                  "`.lock`",
                  "`.unlock`",
                  "`.kick`",
                  "`.ban`"
                ].join("\n")
              )
          ]
        });
      }

      // ====================
      // MINE
      // ====================

      if (
        command === "mine"
      ) {
        return startMine(
          message,
          args[0]
        );
      }

      // ====================
      // MINE İSTATİSTİK
      // ====================

      if (
        command ===
        "mineistatistik"
      ) {
        const user =
          message.mentions.users.first() ||
          message.author;

        const stats =
          db.prepare(`
            SELECT *
            FROM mine_stats
            WHERE guild_id=? AND user_id=?
          `).get(
            message.guild.id,
            user.id
          );

        if (!stats) {
          return message.reply(
            "📊 Henüz Mine istatistiğin yok."
          );
        }

        return message.reply(
          `💣 **Mine İstatistikleri**\n\n` +
          `🎮 Oyun: **${stats.games}**\n` +
          `🏆 Tamamlama: **${stats.wins}**\n` +
          `💥 Mayın: **${stats.losses}**\n` +
          `⭐ En yüksek skor: **${stats.best_score}**`
        );
      }

      // ====================
      // ANTRENMAN
      // ====================

      if (
        command === "ant" ||
        command === "antrenman"
      ) {
        return training(
          message
        );
      }

      // ====================
      // PENALTI
      // ====================

      if (
        command === "pen" ||
        command === "penaltı"
      ) {
        return penalty(
          message
        );
      }

      // ====================
      // DEĞER VER / SİL
      // ====================

      if (
        command === "dver" ||
        command === "dsil"
      ) {
        if (
          !(
            isAdmin(message.member) ||
            message.member.roles.cache.has(
              ROLE_IDS.VALUE
            )
          )
        ) {
          return message.reply(
            "❌ Değer yetkin yok."
          );
        }

        const user =
          message.mentions.users.first();

        const amount =
          parseMoney(args[1]);

        if (
          !user ||
          !Number.isFinite(amount) ||
          amount <= 0
        ) {
          return message.reply(
            `❌ Kullanım: \`.${command} @oyuncu 5M\``
          );
        }

        const delta =
          command === "dver"
            ? amount
            : -amount;

        const newValue =
          await changeValue(
            message.guild,
            user,
            delta,
            command.toUpperCase()
          );

        return message.reply(
          `✅ <@${user.id}> yeni değeri: **${money(newValue)}**`
        );
      }

      // ====================
      // DEĞERLER
      // ====================

      if (
        command === "değerler"
      ) {
        const players =
          db.prepare(`
            SELECT *
            FROM players
            WHERE guild_id=?
            ORDER BY value DESC
            LIMIT 10
          `).all(
            message.guild.id
          );

        if (!players.length) {
          return message.reply(
            "📭 Henüz kayıtlı futbolcu yok."
          );
        }

        const text =
          players.map(
            (p, i) =>
              `${i + 1}. <@${p.user_id}> — **${money(p.value)}** — ⭐ ${p.ovr} 🚀 ${p.pot}`
          ).join("\n");

        return message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xf1c40f)
              .setTitle(
                "💰 EN DEĞERLİ FUTBOLCULAR"
              )
              .setDescription(text)
          ]
        });
      }

      // ====================
      // PROFİL
      // ====================

      if (
        command === "profil"
      ) {
        const user =
          message.mentions.users.first() ||
          message.author;

        const player =
          getPlayer(
            message.guild.id,
            user.id
          );

        if (!player) {
          return message.reply(
            "❌ Bu oyuncu kayıtlı değil."
          );
        }

        return message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x5865f2)
              .setTitle(
                `⚽ ${player.name}`
              )
              .setDescription(
                `👤 Oyuncu: <@${player.user_id}>\n` +
                `🌍 Ülke: ${player.country}\n` +
                `📍 Mevki: **${player.position}**\n` +
                `🔢 Forma: **${player.number || "-"}**\n\n` +

                `⭐ OVR: **${player.ovr}**\n` +
                `🚀 POT: **${player.pot}**\n` +
                `📈 Form: **${player.form}/100**\n` +
                `✨ Seviye: **${player.level}**\n` +
                `XP: **${player.xp}**\n\n` +

                `💰 Değer: **${money(player.value)}**\n` +
                `💵 Bakiye: **${money(player.balance)}**\n` +
                `💼 Maaş: **${money(player.salary)}**\n\n` +

                `⚽ Gol: **${player.goals}**\n` +
                `👟 Asist: **${player.assists}**\n` +
                `🏆 MVP: **${player.mvp}**\n` +
                `🟨 Sarı: **${player.yellow}**\n` +
                `🟥 Kırmızı: **${player.red}**`
              )
          ]
        });
      }

      // ====================
      // FUTBOLCU ARAMA
      // ====================

      if (
        command === "ara"
      ) {
        if (
          (args[0] || "")
            .toLowerCase() !==
          "futbolcu"
        ) {
          return message.reply(
            "❌ Kullanım: `.ara futbolcu isim`"
          );
        }

        const query =
          args
            .slice(1)
            .join(" ")
            .trim();

        if (!query) {
          return message.reply(
            "❌ Futbolcu adı yaz."
          );
        }

        const players =
          db.prepare(`
            SELECT *
            FROM players
            WHERE guild_id=?
            AND name LIKE ?
            LIMIT 10
          `).all(
            message.guild.id,
            `%${query}%`
          );

        if (!players.length) {
          return message.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(0xed4245)
                .setTitle(
                  "🔎 SONUÇ BULUNAMADI"
                )
                .setDescription(
                  "Aradığın futbolcu bulunamadı."
                )
            ]
          });
        }

        return message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x5865f2)
              .setTitle(
                "🔎 FUTBOLCU ARAMA"
              )
              .setDescription(
                players.map(
                  p =>
                    `<@${p.user_id}> — **${p.name}**\n` +
                    `⭐ OVR ${p.ovr} • 🚀 POT ${p.pot} • 💰 ${money(p.value)}`
                ).join("\n\n")
              )
          ]
        });
      }

      // ====================
      // ROL VER / AL
      // ====================

      if (
        command === "rolver" ||
        command === "rolal"
      ) {
        if (
          !isAdmin(
            message.member
          )
        ) {
          return message.reply(
            "❌ Bu komut sadece yönetici içindir."
          );
        }

        const role =
          message.mentions.roles.first();

        const user =
          message.mentions.users.first();

        if (!role || !user) {
          return message.reply(
            `❌ Kullanım: \`.${command} @rol @oyuncu\``
          );
        }

        const member =
          await message.guild.members
            .fetch(user.id)
            .catch(() => null);

        if (!member) {
          return message.reply(
            "❌ Oyuncu bulunamadı."
          );
        }

        if (
          role.id ===
          message.guild.id
        ) {
          return message.reply(
            "❌ @everyone değiştirilemez."
          );
        }

        if (
          role.position >=
          message.guild.members.me
            .roles.highest.position
        ) {
          return message.reply(
            "❌ Bot bu rolü yönetemiyor."
          );
        }

        if (
          command === "rolver"
        ) {
          await member.roles.add(
            role
          );
        } else {
          await member.roles.remove(
            role
          );
        }

        return message.reply(
          `✅ ${role} rolü <@${user.id}> için ${command === "rolver" ? "verildi" : "alındı"}.`
        );
      }

      // ====================
      // MESAJ SİL
      // ====================

      if (
        command === "sil"
      ) {
        if (
          !isAdmin(
            message.member
          )
        ) {
          return message.reply(
            "❌ Yetkin yok."
          );
        }

        const amount =
          Number(args[0]);

        if (
          !Number.isInteger(amount) ||
          amount < 1 ||
          amount > 1000
        ) {
          return message.reply(
            "❌ Miktar **1-1000** arasında olmalı."
          );
        }

        let remaining =
          amount;

        let deleted = 0;

        while (
          remaining > 0
        ) {
          const batch =
            Math.min(
              remaining,
              100
            );

          const messages =
            await message.channel
              .bulkDelete(
                batch,
                true
              )
              .catch(() => null);

          if (
            !messages ||
            messages.size === 0
          ) break;

          deleted +=
            messages.size;

          remaining -=
            messages.size;

          if (
            messages.size < batch
          ) break;
        }

        const info =
          await message.channel
            .send(
              `🧹 **${deleted}** mesaj silindi.`
            )
            .catch(() => null);

        if (info) {
          setTimeout(
            () =>
              info.delete()
                .catch(() => {}),
            3000
          );
        }

        return;
      }

      // ====================
      // KANAL KİLİT
      // ====================

      if (
        command === "lock" ||
        command === "kilit"
      ) {
        if (
          !isAdmin(
            message.member
          )
        ) {
          return message.reply(
            "❌ Yetkin yok."
          );
        }

        await message.channel
          .permissionOverwrites
          .edit(
            message.guild.roles.everyone,
            {
              SendMessages: false
            }
          );

        return message.reply(
          "🔒 Kanal kilitlendi."
        );
      }

      // ====================
      // KANAL AÇ
      // ====================

      if (
        command === "unlock" ||
        command === "kilitaç"
      ) {
        if (
          !isAdmin(
            message.member
          )
        ) {
          return message.reply(
            "❌ Yetkin yok."
          );
        }

        await message.channel
          .permissionOverwrites
          .edit(
            message.guild.roles.everyone,
            {
              SendMessages: true
            }
          );

        return message.reply(
          "🔓 Kanal açıldı."
        );
      }

    } catch (error) {
      console.error(
        "COMMAND ERROR:",
        error
      );

      return message.reply(
        "❌ İşlem sırasında hata oluştu."
      ).catch(() => {});
    }
  }
);

// =========================
// BOT HAZIR
// =========================

client.once(
  "ready",
  () => {
    console.log(
      `✅ ${client.user.tag} aktif!`
    );

    client.user.setActivity(
      "Football RP | .yardım",
      {
        type: 0
      }
    );
  }
);

// =========================
// TOKEN
// =========================

if (!process.env.TOKEN) {
  console.error(
    "❌ TOKEN bulunamadı!"
  );

  process.exit(1);
}

client.login(
  process.env.TOKEN
);
