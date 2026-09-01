const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  ChannelType
} = require("discord.js");

const fs = require("fs");

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

const TOKEN = process.env.TOKEN;
const PREFIX = ".";

// =====================================================
// ROLLER
// =====================================================

const ROLES = {
  YONETICI: "1544449436011339806",
  KAYIT: "1544452022764568656",
  DEGER: "1544451743746891806",
  MODERATOR: "1544450307088715917",
  TEKNIK_DIREKTOR: "1544452323450032229",
  OYUNCU: "1544452779156709516",

  // BURAYA KAYITSIZ ROL ID'Nİ YAZ
  KAYITSIZ: "KAYITSIZ_ROLE_ID"
};

// =====================================================
// TAKIMLAR
// =====================================================

const TAKIMLAR = [
  "Galatasaray",
  "Fenerbahçe",
  "Beşiktaş",
  "Trabzonspor",
  "Başakşehir",
  "Manchester United",
  "Manchester City",
  "Liverpool",
  "Arsenal",
  "Chelsea",
  "Tottenham Hotspur",
  "Newcastle United",
  "Real Madrid",
  "Barcelona",
  "Atlético Madrid",
  "Sevilla",
  "Valencia",
  "Bayern Münih",
  "Borussia Dortmund",
  "RB Leipzig",
  "Bayer Leverkusen",
  "Inter",
  "Milan",
  "Juventus",
  "Napoli",
  "Roma",
  "Lazio",
  "Paris Saint-Germain",
  "Ajax",
  "PSV Eindhoven",
  "Benfica",
  "Porto",
  "Sporting Lizbon",
  "Feyenoord",
  "Monaco"
];

const FORMASYONLAR = [
  "4-2-1-3-2",
  "4-3-3",
  "4-2-3-1",
  "4-4-2",
  "4-1-2-3",
  "3-4-3",
  "3-5-2",
  "5-3-2",
  "5-4-1"
];

// =====================================================
// KANALLAR
// =====================================================

const CHANNELS = {};

// =====================================================
// VERİ
// =====================================================

const DEFAULT_DATA = {
  channels: {},
  teams: {},
  players: {},
  contracts: {},
  transfers: [],
  valueHistory: [],
  budgetHistory: [],
  matches: [],
  warnings: {},
  giveaways: {},
  sponsors: {},
  companies: {},
  usedTeams: [],
  registered: {},
  nextTransferId: 1
};

function loadData() {
  try {
    if (!fs.existsSync("data.json")) {
      fs.writeFileSync(
        "data.json",
        JSON.stringify(DEFAULT_DATA, null, 2)
      );
      return JSON.parse(JSON.stringify(DEFAULT_DATA));
    }

    const data = JSON.parse(
      fs.readFileSync("data.json", "utf8")
    );

    return {
      ...DEFAULT_DATA,
      ...data,
      channels: {
        ...DEFAULT_DATA.channels,
        ...(data.channels || {})
      }
    };
  } catch (error) {
    console.log("data.json okunamadı.");
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}

let db = loadData();

function saveData() {
  fs.writeFileSync(
    "data.json",
    JSON.stringify(db, null, 2)
  );
}

// =====================================================
// PARA
// =====================================================

function para(value) {
  value = Math.max(0, Math.round(Number(value) || 0));

  if (value >= 1000000000) {
    return `${(value / 1000000000).toFixed(
      value % 1000000000 ? 1 : 0
    )}B€`;
  }

  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(
      value % 1000000 ? 1 : 0
    )}M€`;
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(
      value % 1000 ? 1 : 0
    )}K€`;
  }

  return `${value}€`;
}

function paraCevir(text) {
  if (!text) return NaN;

  const temiz = String(text)
    .trim()
    .toUpperCase()
    .replace(/,/g, ".")
    .replace(/\s/g, "");

  const match = temiz.match(/^([\d.]+)(B|M|K)?€?$/);

  if (!match) return NaN;

  const sayi = Number(match[1]);

  if (!Number.isFinite(sayi)) return NaN;

  if (match[2] === "B") return Math.round(sayi * 1000000000);
  if (match[2] === "M") return Math.round(sayi * 1000000);
  if (match[2] === "K") return Math.round(sayi * 1000);

  return Math.round(sayi);
}

// =====================================================
// YETKİ
// =====================================================

function rolVar(member, roleId) {
  return member?.roles?.cache?.has(roleId);
}

function yonetici(member) {
  return (
    member?.permissions?.has(
      PermissionsBitField.Flags.Administrator
    ) || rolVar(member, ROLES.YONETICI)
  );
}

function moderator(member) {
  return (
    yonetici(member) ||
    rolVar(member, ROLES.MODERATOR)
  );
}

function degerYetkilisi(member) {
  return (
    yonetici(member) ||
    rolVar(member, ROLES.DEGER)
  );
}

function kayitYetkilisi(member) {
  return (
    yonetici(member) ||
    rolVar(member, ROLES.KAYIT)
  );
}

function teknikDirektor(member) {
  return (
    yonetici(member) ||
    rolVar(member, ROLES.TEKNIK_DIREKTOR)
  );
}

// =====================================================
// OYUNCU VERİSİ
// =====================================================

function oyuncuVerisi(id) {
  if (!db.players[id]) {
    db.players[id] = {
      value: 0,
      personalBudget: 0,
      training: 1,
      goals: 0,
      assists: 0,
      penalties: 0,
      penaltyGoals: 0,
      saves: 0,
      team: null,
      formation: "4-2-1-3-2",
      yellow: 0,
      red: 0
    };
  }

  return db.players[id];
}

// =====================================================
// TAKIM BULMA
// =====================================================

function takimBul(name) {
  if (!name) return null;

  return db.teams[name] || null;
}

function oyuncununTakimi(id) {
  const p = oyuncuVerisi(id);

  if (!p.team) return null;

  return db.teams[p.team] || null;
}

function tdTakimi(id) {
  return Object.values(db.teams).find(
    team => team.td === id
  );
}

function kanal(guild, key) {
  const id = db.channels[key];

  if (!id) return null;

  return guild.channels.cache.get(id);
}

async function log(guild, key, message) {
  const ch =
    kanal(guild, key) ||
    kanal(guild, "yetkiliLog");

  if (!ch) return;

  await ch.send(message).catch(() => {});
}

function etiket(id) {
  return id ? `<@${id}>` : "-";
}

// =====================================================
// SUNUCU KUR
// =====================================================

async function sunucuKur(guild) {
  const yapilar = {
    "UNITED LEAGUE": [
      ["📢・duyurular", "duyurular"],
      ["👋・gelen-giden", "gelenGiden"],
      ["📜・kurallar", "kurallar"]
    ],

    "💬 SOHBET": [
      ["💬・sohbet", "sohbet"],
      ["🤖・bot-komut", "botKomut"],
      ["🖼️・görsel", "gorsel"]
    ],

    "KAYIT": [
      ["📝・kayıt", "kayit"],
      ["📋・kayıt-log", "kayitLog"]
    ],

    "TAKIM & KADRO": [
      ["🏟️・takımlar", "takimlar"],
      ["👥・kadrolar", "kadrolar"],
      ["📊・puan-durumu", "puan"],
      ["📅・fikstür", "fikstur"],
      ["⚽・maçlar", "maclar"]
    ],

    "TRANSFER": [
      ["🔄・transfer", "transfer"],
      ["📜・sözleşmeler", "sozlesmeler"],
      ["💰・transfer-log", "transferLog"]
    ],

    "EKONOMİ": [
      ["💵・bütçeler", "butceler"],
      ["💎・değerler", "degerler"],
      ["🤝・sponsorlar", "sponsorlar"],
      ["🏢・şirketler", "sirketler"]
    ],

    "MEDYA": [
      ["📰・haberler", "haberler"],
      ["🐦・tweetler", "tweetler"],
      ["📸・transfer-duyuruları", "transferDuyuru"]
    ],

    "YETKİLİ": [
      ["🔐・yetkili-sohbet", "yetkiliSohbet"],
      ["📋・yetkili-log", "yetkiliLog"],
      ["🛡️・moderasyon-log", "moderasyonLog"],
      ["🎁・çekiliş-log", "cekilisLog"]
    ]
  };

  for (const [kategoriAdi, kanallar] of Object.entries(yapilar)) {
    let kategori = guild.channels.cache.find(
      c =>
        c.type === ChannelType.GuildCategory &&
        c.name === kategoriAdi
    );

    if (!kategori) {
      kategori = await guild.channels.create({
        name: kategoriAdi,
        type: ChannelType.GuildCategory
      });
    }

    for (const [kanalAdi, key] of kanallar) {
      let ch = guild.channels.cache.find(
        c =>
          c.type === ChannelType.GuildText &&
          c.name === kanalAdi.replace(/^.+?・/, "") &&
          c.parentId === kategori.id
      );

      if (!ch) {
        ch = await guild.channels.create({
          name: kanalAdi,
          type: ChannelType.GuildText,
          parent: kategori.id
        });
      }

      db.channels[key] = ch.id;

      // KAYIT KANALI
      if (key === "kayit") {
        await ch.permissionOverwrites.edit(
          guild.roles.everyone,
          {
            ViewChannel: false
          }
        );

        if (
          ROLES.KAYITSIZ !== "KAYITSIZ_ROLE_ID" &&
          guild.roles.cache.has(ROLES.KAYITSIZ)
        ) {
          await ch.permissionOverwrites.edit(
            ROLES.KAYITSIZ,
            {
              ViewChannel: true,
              SendMessages: true,
              ReadMessageHistory: true
            }
          );
        }

        if (guild.roles.cache.has(ROLES.KAYIT)) {
          await ch.permissionOverwrites.edit(
            ROLES.KAYIT,
            {
              ViewChannel: true,
              SendMessages: true,
              ReadMessageHistory: true
            }
          );
        }

        if (guild.roles.cache.has(ROLES.YONETICI)) {
          await ch.permissionOverwrites.edit(
            ROLES.YONETICI,
            {
              ViewChannel: true
            }
          );
        }
      }

      // LOG / YETKİLİ KANALLARI
      if (
        [
          "kayitLog",
          "yetkiliSohbet",
          "yetkiliLog",
          "moderasyonLog",
          "cekilisLog"
        ].includes(key)
      ) {
        await ch.permissionOverwrites.edit(
          guild.roles.everyone,
          {
            ViewChannel: false
          }
        );

        if (guild.roles.cache.has(ROLES.YONETICI)) {
          await ch.permissionOverwrites.edit(
            ROLES.YONETICI,
            {
              ViewChannel: true,
              SendMessages: true
            }
          );
        }
      }
    }
  }

  saveData();
}

// =====================================================
// HAZIR
// =====================================================

client.once("ready", () => {
  console.log("====================================");
  console.log(" UNITED LEAGUE BOT AKTİF");
  console.log(` Bot: ${client.user.tag}`);
  console.log("====================================");
});

// =====================================================
// YENİ ÜYE
// =====================================================

client.on("guildMemberAdd", async member => {
  oyuncuVerisi(member.id);
  saveData();

  const ch = kanal(member.guild, "gelenGiden");

  if (ch) {
    await ch.send(
      `👋 **Yeni üye geldi!** ${member}\n📝 Kayıt olmak için kayıt kanalına geçebilirsin.`
    );
  }
});

// =====================================================
// BUTONLAR
// =====================================================

client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;

  // KAYIT
  if (interaction.customId.startsWith("kayit_")) {
    const parts = interaction.customId.split("_");

    const targetId = parts[1];
    const type = parts[2];

    if (interaction.user.id !== targetId) {
      return interaction.reply({
        content: "❌ Bu kayıt işlemi sana ait değil.",
        ephemeral: true
      });
    }

    const member =
      await interaction.guild.members
        .fetch(targetId)
        .catch(() => null);

    if (!member) {
      return interaction.reply({
        content: "❌ Oyuncu bulunamadı.",
        ephemeral: true
      });
    }

    // Kayıtsız rolünü kaldır
    if (
      ROLES.KAYITSIZ !== "KAYITSIZ_ROLE_ID" &&
      member.roles.cache.has(ROLES.KAYITSIZ)
    ) {
      await member.roles.remove(ROLES.KAYITSIZ).catch(() => {});
    }

    // Futbolcu
    if (type === "oyuncu") {
      await member.roles
        .add(ROLES.OYUNCU)
        .catch(() => {});
    }

    // TD
    if (type === "td") {
      await member.roles
        .add(ROLES.TEKNIK_DIREKTOR)
        .catch(() => {});
    }

    oyuncuVerisi(member.id);

    db.registered[member.id] = {
      type,
      date: new Date().toISOString()
    };

    saveData();

    const sohbet = kanal(
      interaction.guild,
      "sohbet"
    );

    if (sohbet) {
      await sohbet.send(
        `🎉 ${member} **${
          type === "oyuncu"
            ? "Futbolcu"
            : "Teknik Direktör"
        }** olarak kayıt oldu!`
      );
    }

    await log(
      interaction.guild,
      "kayitLog",
      `📝 Kayıt tamamlandı: ${member.user.tag} → ${type}`
    );

    return interaction.update({
      content: `✅ ${member} kaydı tamamlandı.`,
      components: []
    });
  }

  // ÇEKİLİŞ
  if (interaction.customId.startsWith("cekilis_")) {
    const id =
      interaction.customId.replace("cekilis_", "");

    const giveaway = db.giveaways[id];

    if (!giveaway) {
      return interaction.reply({
        content: "❌ Bu çekiliş artık aktif değil.",
        ephemeral: true
      });
    }

    if (!giveaway.users.includes(interaction.user.id)) {
      giveaway.users.push(interaction.user.id);
      saveData();
    }

    return interaction.reply({
      content: "🎉 Çekilişe katıldın!",
      ephemeral: true
    });
  }

  // TD TRANSFER ONAY
  if (interaction.customId.startsWith("td_onay_")) {
    const id =
      interaction.customId.replace("td_onay_", "");

    const contract = db.contracts[id];

    if (!contract) {
      return interaction.reply({
        content: "❌ Bu transfer artık geçerli değil.",
        ephemeral: true
      });
    }

    const oldTeam =
      db.teams[contract.oldTeam];

    if (
      !oldTeam ||
      oldTeam.td !== interaction.user.id
    ) {
      return interaction.reply({
        content:
          "❌ Bu transferi yalnızca mevcut Teknik Direktör onaylayabilir.",
        ephemeral: true
      });
    }

    contract.oldApproved = true;
    saveData();

    return interaction.update({
      content:
        "✅ Transfer onaylandı. Oyuncunun onayı bekleniyor.",
      components: []
    });
  }

  // TD TRANSFER RED
  if (interaction.customId.startsWith("td_red_")) {
    const id =
      interaction.customId.replace("td_red_", "");

    const contract = db.contracts[id];

    if (!contract) {
      return interaction.reply({
        content: "❌ Transfer bulunamadı.",
        ephemeral: true
      });
    }

    const oldTeam =
      db.teams[contract.oldTeam];

    if (
      !oldTeam ||
      oldTeam.td !== interaction.user.id
    ) {
      return interaction.reply({
        content:
          "❌ Bu işlemi yalnızca mevcut Teknik Direktör yapabilir.",
        ephemeral: true
      });
    }

    delete db.contracts[id];
    saveData();

    return interaction.update({
      content: "❌ Transfer reddedildi.",
      components: []
    });
  }

  // OYUNCU KABUL
  if (interaction.customId.startsWith("oyuncu_kabul_")) {
    const id =
      interaction.customId.replace(
        "oyuncu_kabul_",
        ""
      );

    const contract = db.contracts[id];

    if (!contract) {
      return interaction.reply({
        content: "❌ Sözleşme bulunamadı.",
        ephemeral: true
      });
    }

    if (
      interaction.user.id !== contract.player
    ) {
      return interaction.reply({
        content: "❌ Bu teklif sana ait değil.",
        ephemeral: true
      });
    }

    if (
      contract.oldTeam &&
      !contract.oldApproved
    ) {
      return interaction.reply({
        content:
          "❌ Önce mevcut takımın Teknik Direktörü transferi onaylamalı.",
        ephemeral: true
      });
    }

    const newTeam =
      db.teams[contract.newTeam];

    if (!newTeam) {
      return interaction.reply({
        content: "❌ Yeni takım bulunamadı.",
        ephemeral: true
      });
    }

    const oldTeam = contract.oldTeam
      ? db.teams[contract.oldTeam]
      : null;

    // Yeni takım bütçesi kontrol
    if (newTeam.budget < contract.fee) {
      return interaction.reply({
        content:
          "❌ Yeni takımın bonservis için yeterli bütçesi yok.",
        ephemeral: true
      });
    }

    // Eski takımdan çıkar
    if (oldTeam) {
      oldTeam.squad =
        oldTeam.squad.filter(
          id => id !== contract.player
        );

      if (
        oldTeam.roleId
      ) {
        await interaction.member.roles
          .remove(oldTeam.roleId)
          .catch(() => {});
      }
    }

    // Bonservis
    newTeam.budget -= contract.fee;

    if (oldTeam) {
      oldTeam.budget += contract.fee;
    }

    // Yeni kadro
    if (!newTeam.squad.includes(contract.player)) {
      newTeam.squad.push(contract.player);
    }

    // Oyuncu takımını değiştir
    const player =
      oyuncuVerisi(contract.player);

    player.team = newTeam.name;

    // Yeni takım rolü
    if (newTeam.roleId) {
      await interaction.member.roles
        .add(newTeam.roleId)
        .catch(() => {});
    }

    db.transfers.push({
      ...contract,
      completedAt:
        new Date().toISOString()
    });

    delete db.contracts[id];

    saveData();

    // Transfer duyurusu
    const transferChannel =
      kanal(
        interaction.guild,
        "transferDuyuru"
      ) ||
      kanal(
        interaction.guild,
        "transfer"
      );

    if (transferChannel) {
      const embed =
        new EmbedBuilder()
          .setTitle(
            "🔄 RESMÎ TRANSFER"
          )
          .setDescription(
            `**${interaction.user.username}**\n\n` +
            `${oldTeam?.name || "Serbest"} ➜ **${newTeam.name}**`
          )
          .addFields(
            {
              name: "💰 Bonservis",
              value: para(contract.fee),
              inline: true
            },
            {
              name: "💵 Maaş",
              value: para(contract.salary),
              inline: true
            },
            {
              name: "📜 Sözleşme",
              value: contract.duration,
              inline: true
            },
            {
              name: "📅 Tarih",
              value:
                new Date().toLocaleDateString(
                  "tr-TR"
                ),
              inline: true
            }
          )
          .setTimestamp();

      await transferChannel.send({
        embeds: [embed]
      });
    }

    await log(
      interaction.guild,
      "transferLog",
      `🔄 Transfer tamamlandı: ${interaction.user.tag} → ${newTeam.name}`
    );

    return interaction.update({
      content:
        "✅ Transfer tamamlandı! Yeni takım rolün verildi ve eski takım rolün kaldırıldı.",
      components: []
    });
  }

  // OYUNCU RED
  if (interaction.customId.startsWith("oyuncu_red_")) {
    const id =
      interaction.customId.replace(
        "oyuncu_red_",
        ""
      );

    const contract = db.contracts[id];

    if (!contract) {
      return interaction.reply({
        content: "❌ Sözleşme bulunamadı.",
        ephemeral: true
      });
    }

    if (
      interaction.user.id !== contract.player
    ) {
      return interaction.reply({
        content: "❌ Bu teklif sana ait değil.",
        ephemeral: true
      });
    }

    delete db.contracts[id];
    saveData();

    return interaction.update({
      content: "❌ Sözleşme reddedildi.",
      components: []
    });
  }
});

// =====================================================
// TAKIM SEÇİMİ
// =====================================================

client.on(
  "interactionCreate",
  async interaction => {
    if (
      !interaction.isStringSelectMenu()
    ) {
      return;
    }

    if (
      interaction.customId !==
      "takim_sec"
    ) {
      return;
    }

    if (
      !teknikDirektor(
        interaction.member
      )
    ) {
      return interaction.reply({
        content:
          "❌ Sadece Teknik Direktörler takım kurabilir.",
        ephemeral: true
      });
    }

    if (
      tdTakimi(
        interaction.user.id
      )
    ) {
      return interaction.reply({
        content:
          "❌ Zaten bir takımın var.",
        ephemeral: true
      });
    }

    const takimAdi =
      interaction.values[0];

    if (
      db.usedTeams.includes(
        takimAdi
      )
    ) {
      return interaction.reply({
        content:
          "❌ Bu takım daha önce alınmış.",
        ephemeral: true
      });
    }

    const role =
      await interaction.guild.roles.create({
        name: takimAdi,
        reason:
          "United League takım rolü"
      });

    db.teams[takimAdi] = {
      name: takimAdi,
      roleId: role.id,
      td: interaction.user.id,
      budget: 100000000,
      squad: [],
      formation: "4-2-1-3-2",
      sponsor: null,
      company: null,
      stats: {
        o: 0,
        g: 0,
        b: 0,
        m: 0,
        ag: 0,
        yg: 0,
        p: 0
      }
    };

    db.usedTeams.push(takimAdi);

    const p =
      oyuncuVerisi(
        interaction.user.id
      );

    p.team = takimAdi;

    saveData();

    await interaction.member.roles
      .add(role)
      .catch(() => {});

    await log(
      interaction.guild,
      "yetkiliLog",
      `🏟️ Takım kuruldu: ${takimAdi} | TD: ${interaction.user.tag}`
    );

    return interaction.update({
      content:
        `✅ **${takimAdi}** takımını kurdun!\n\n` +
        `💰 Başlangıç takım bütçesi: **100M€**`,
      components: []
    });
  }
);

// =====================================================
// MESAJ KOMUTLARI
// =====================================================

client.on(
  "messageCreate",
  async message => {
    if (
      message.author.bot ||
      !message.guild ||
      !message.content.startsWith(PREFIX)
    ) {
      return;
    }

    const parts =
      message.content
        .trim()
        .split(/\s+/);

    const command =
      parts.shift().toLowerCase();

    const args = parts;

    const botKomut =
      kanal(
        message.guild,
        "botKomut"
      );

    // Bot komutları bot-komut kanalında
    if (
      botKomut &&
      message.channel.id !== botKomut.id &&
      command !== ".sunucukur"
    ) {
      return;
    }

    // =================================================
    // SUNUCU KUR
    // =================================================

    if (
      command === ".sunucukur"
    ) {
      if (!yonetici(message.member)) {
        return message.reply(
          "❌ Bu komut sadece yöneticiler içindir."
        );
      }

      await sunucuKur(
        message.guild
      );

      return message.reply(
        "✅ **United League** kategorileri ve kanalları oluşturuldu!\n\n" +
        "🔒 Kayıt kanalı yalnızca **Kayıtsız** rolüne açıldı."
      );
    }

    // =================================================
    // KAYIT
    // =================================================

    if (command === ".k") {
      if (
        !kayitYetkilisi(
          message.member
        )
      ) {
        return message.reply(
          "❌ Kayıt yetkin yok."
        );
      }

      const target =
        message.mentions.users.first();

      if (!target) {
        return message.reply(
          "❌ Kullanım: `.k @oyuncu İsim`"
        );
      }

      const row =
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(
              `kayit_${target.id}_oyuncu`
            )
            .setLabel(
              "⚽ Futbolcu"
            )
            .setStyle(
              ButtonStyle.Success
            ),

          new ButtonBuilder()
            .setCustomId(
              `kayit_${target.id}_td`
            )
            .setLabel(
              "👔 Teknik Direktör"
            )
            .setStyle(
              ButtonStyle.Primary
            )
        );

      return message.reply({
        content:
          `📝 **${target.tag}** için kayıt türünü seçin:`,
        components: [row]
      });
    }

    // =================================================
    // TAKIM KUR
    // =================================================

    if (
      command === ".takımkur"
    ) {
      if (
        !teknikDirektor(
          message.member
        )
      ) {
        return message.reply(
          "❌ Teknik Direktör yetkin yok."
        );
      }

      if (
        tdTakimi(
          message.author.id
        )
      ) {
        return message.reply(
          "❌ Zaten bir takımın var."
        );
      }

      const bosTakimlar =
        TAKIMLAR.filter(
          x =>
            !db.usedTeams.includes(x)
        ).slice(0, 25);

      if (!bosTakimlar.length) {
        return message.reply(
          "❌ Kullanılabilir takım kalmadı."
        );
      }

      const menu =
        new StringSelectMenuBuilder()
          .setCustomId(
            "takim_sec"
          )
          .setPlaceholder(
            "Gerçek takımını seç"
          )
          .addOptions(
            bosTakimlar.map(
              takim => ({
                label: takim,
                value: takim
              })
            )
          );

      return message.reply({
        content:
          "⚽ **Takımını seç:**",
        components: [
          new ActionRowBuilder().addComponents(
            menu
          )
        ]
      });
    }

    // =================================================
    // DEĞER VER
    // =================================================

    if (
      command === ".dver" ||
      command === ".dsil"
    ) {
      if (
        !degerYetkilisi(
          message.member
        )
      ) {
        return message.reply(
          "❌ Değer yetkin yok."
        );
      }

      const target =
        message.mentions.users.first();

      const miktar =
        paraCevir(args[1]);

      if (
        !target ||
        !Number.isFinite(miktar)
      ) {
        return message.reply(
          `❌ Kullanım: \`${command} @oyuncu 5M\``
        );
      }

      const p =
        oyuncuVerisi(
          target.id
        );

      const eski =
        p.value;

      if (
        command === ".dver"
      ) {
        p.value += miktar;
      } else {
        p.value =
          Math.max(
            0,
            p.value - miktar
          );
      }

      db.valueHistory.push({
        user: target.id,
        oldValue: eski,
        newValue: p.value,
        change:
          p.value - eski,
        by: message.author.id,
        date:
          new Date().toISOString()
      });

      saveData();

      // SADECE SON KISIMI DEĞİŞTİR
      // İsim / bayrak / mevki korunur
      const member =
        await message.guild.members
          .fetch(target.id)
          .catch(() => null);

      if (member) {
        const nickname =
          member.displayName;

        const sections =
          nickname
            .split("|")
            .map(x => x.trim());

        if (
          sections.length >= 2
        ) {
          sections[
            sections.length - 1
          ] = para(p.value);

          await member
            .setNickname(
              sections.join(
                " | "
              )
            )
            .catch(() => {});
        } else {
          await member
            .setNickname(
              `${nickname} | ${para(
                p.value
              )}`
            )
            .catch(() => {});
        }
      }

      await log(
        message.guild,
        "degerler",
        `💎 ${target.tag}: ${para(eski)} → ${para(p.value)} | Yetkili: ${message.author.tag}`
      );

      return message.reply(
        `💎 ${target} değeri **${para(eski)} → ${para(
          p.value
        )}** oldu.`
      );
    }

    // =================================================
    // DEĞER
    // =================================================

    if (
      command === ".değer"
    ) {
      const target =
        message.mentions.users.first() ||
        message.author;

      const p =
        oyuncuVerisi(
          target.id
        );

      return message.reply(
        `💎 ${target} oyuncu değeri: **${para(
          p.value
        )}**`
      );
    }

    // =================================================
    // DEĞER GEÇMİŞİ
    // =================================================

    if (
      command === ".değergeçmiş"
    ) {
      const target =
        message.mentions.users.first() ||
        message.author;

      const history =
        db.valueHistory
          .filter(
            x =>
              x.user ===
              target.id
          )
          .slice(-10);

      if (!history.length) {
        return message.reply(
          "📜 Değer geçmişi bulunamadı."
        );
      }

      return message.reply(
        history
          .map(
            x =>
              `• ${new Date(
                x.date
              ).toLocaleDateString(
                "tr-TR"
              )} — ${x.change >= 0 ? "+" : ""}${para(
                x.change
              )}`
          )
          .join("\n")
      );
    }

    // =================================================
    // ANTRENMAN
    // =================================================

    if (
      command === ".ant" ||
      command === ".antrenman"
    ) {
      const p =
        oyuncuVerisi(
          message.author.id
        );

      p.training =
        (p.training || 1) + 1;

      if (
        p.training >= 10
      ) {
        p.training = 1;
        p.value += 3000000;

        saveData();

        return message.reply(
          `🏋️ **10/10 ANTRENMAN TAMAMLANDI!**\n\n` +
          `💎 Değer artışı: **+3M€**\n` +
          `💰 Yeni değer: **${para(
            p.value
          )}**\n\n` +
          `🔄 Antrenman tekrar **1/10** olarak başladı.`
        );
      }

      saveData();

      return message.reply(
        `🏋️ Antrenman ilerlemesi: **${p.training}/10**`
      );
    }

    // =================================================
    // PENALTI
    // =================================================

    if (
      command === ".pen" ||
      command === ".penaltı"
    ) {
      const p =
        oyuncuVerisi(
          message.author.id
        );

      p.penalties++;

      const gol =
        Math.random() < 0.6;

      if (gol) {
        p.penaltyGoals++;
        p.goals++;
        p.value += 2000000;

        saveData();

        return message.reply(
          `⚽ **GOOOOL!**\n\n` +
          `💎 Değer artışı: **+2M€**\n` +
          `💰 Yeni değer: **${para(
            p.value
          )}`
        );
      }

      p.saves++;

      saveData();

      return message.reply(
        "🧤 **KURTARIŞ!** Penaltı gole dönüşmedi."
      );
    }

    // =================================================
    // KADRO EKLE
    // =================================================

    if (
      command === ".kadroekle"
    ) {
      const team =
        tdTakimi(
          message.author.id
        );

      if (
        !team ||
        team.td !==
          message.author.id
      ) {
        return message.reply(
          "❌ Yalnızca kendi takımının Teknik Direktörü kadro yönetebilir."
        );
      }

      const target =
        message.mentions.users.first();

      if (!target) {
        return message.reply(
          "❌ Kullanım: `.kadroekle @oyuncu`"
        );
      }

      const p =
        oyuncuVerisi(
          target.id
        );

      if (
        p.team !==
        team.name
      ) {
        return message.reply(
          "❌ Bu oyuncu senin takımında değil."
        );
      }

      if (
        team.squad.includes(
          target.id
        )
      ) {
        return message.reply(
          "❌ Oyuncu zaten kadroda."
        );
      }

      team.squad.push(
        target.id
      );

      saveData();

      return message.reply(
        `✅ ${target} kadroya eklendi.`
      );
    }

    // =================================================
    // KADRO ÇIKAR
    // =================================================

    if (
      command === ".kadroçıkar"
    ) {
      const team =
        tdTakimi(
          message.author.id
        );

      if (
        !team ||
        team.td !==
          message.author.id
      ) {
        return message.reply(
          "❌ Yalnızca kendi takımının Teknik Direktörü kadro yönetebilir."
        );
      }

      const target =
        message.mentions.users.first();

      if (!target) {
        return message.reply(
          "❌ Oyuncu belirt."
        );
      }

      team.squad =
        team.squad.filter(
          id =>
            id !==
            target.id
        );

      saveData();

      return message.reply(
        `✅ ${target} kadrodan çıkarıldı.`
      );
    }

    // =================================================
    // FORMASYON
    // =================================================

    if (
      command === ".formasyon"
    ) {
      const team =
        tdTakimi(
          message.author.id
        );

      if (!team) {
        return message.reply(
          "❌ Bir takımın yok."
        );
      }

      const formasyon =
        args[0];

      if (
        !FORMASYONLAR.includes(
          formasyon
        )
      ) {
        return message.reply(
          `❌ Geçerli formasyonlar:\n${FORMASYONLAR.join(
            ", "
          )}`
        );
      }

      team.formation =
        formasyon;

      saveData();

      return message.reply(
        `📋 Formasyon **${formasyon}** olarak ayarlandı.`
      );
    }

    // =================================================
    // KADRO
    // =================================================

    if (
      command === ".kadro" ||
      command === ".kadrom"
    ) {
      let team;

      if (
        command === ".kadrom"
      ) {
        team =
          oyuncununTakimi(
            message.author.id
          );
      } else {
        team =
          db.teams[
            args.join(" ")
          ];
      }

      if (!team) {
        return message.reply(
          "❌ Takım bulunamadı."
        );
      }

      const players =
        team.squad.length
          ? team.squad
              .map(
                id =>
                  `⚽ ${etiket(id)}`
              )
              .join("\n")
          : "Kadro boş.";

      const embed =
        new EmbedBuilder()
          .setTitle(
            `🏟️ ${team.name} — KADRO`
          )
          .setDescription(
            `📋 **Formasyon:** ${team.formation}\n\n${players}`
          )
          .addFields({
            name: "👔 Teknik Direktör",
            value: etiket(
              team.td
            ),
            inline: true
          });

      return message.reply({
        embeds: [embed]
      });
    }

    // =================================================
    // OYUNCU AL
    // =================================================

    if (
      command === ".oyuncual"
    ) {
      if (
        !teknikDirektor(
          message.member
        )
      ) {
        return message.reply(
          "❌ Teknik Direktör yetkin yok."
        );
      }

      const team =
        tdTakimi(
          message.author.id
        );

      if (!team) {
        return message.reply(
          "❌ Önce bir takım kurmalısın."
        );
      }

      const target =
        message.mentions.users.first();

      if (!target) {
        return message.reply(
          "❌ Kullanım: `.oyuncual @oyuncu 10M 500K 2sezon`"
        );
      }

      const player =
        oyuncuVerisi(
          target.id
        );

      const oldTeam =
        player.team
          ? db.teams[player.team]
          : null;

      // Takım sahibi transfer edilemez
      if (
        oldTeam &&
        oldTeam.td ===
          target.id
      ) {
        return message.reply(
          "❌ Takım sahibi başka takım tarafından transfer edilemez."
        );
      }

      const fee =
        paraCevir(args[1]) || 0;

      const salary =
        paraCevir(args[2]) || 0;

      const duration =
        args[3] ||
        "1 sezon";

      if (
        team.budget <
        fee
      ) {
        return message.reply(
          "❌ Takım bütçesi bonservis için yetersiz."
        );
      }

      const id =
        String(
          db.nextTransferId++
        );

      db.contracts[id] = {
        id,
        player: target.id,
        newTeam: team.name,
        oldTeam:
          oldTeam?.name ||
          null,
        fee,
        salary,
        duration,
        oldApproved:
          !oldTeam
      };

      saveData();

      // Eski TD onayı
      if (
        oldTeam &&
        oldTeam.td
      ) {
        const oldTD =
          await message.guild.members
            .fetch(
              oldTeam.td
            )
            .catch(
              () => null
            );

        if (oldTD) {
          await oldTD
            .send({
              content:
                `🔄 **TRANSFER ONAYI**\n\n` +
                `👤 Oyuncu: ${target.tag}\n` +
                `🏟️ Eski takım: ${oldTeam.name}\n` +
                `🏟️ Yeni takım: ${team.name}\n` +
                `💰 Bonservis: ${para(
                  fee
                )}\n` +
                `💵 Maaş: ${para(
                  salary
                )}\n` +
                `📜 Süre: ${duration}`,
              components: [
                new ActionRowBuilder().addComponents(
                  new ButtonBuilder()
                    .setCustomId(
                      `td_onay_${id}`
                    )
                    .setLabel(
                      "✅ Onayla"
                    )
                    .setStyle(
                      ButtonStyle.Success
                    ),

                  new ButtonBuilder()
                    .setCustomId(
                      `td_red_${id}`
                    )
                    .setLabel(
                      "❌ Reddet"
                    )
                    .setStyle(
                      ButtonStyle.Danger
                    )
                )
              ]
            })
            .catch(
              () => {}
            );
        }
      }

      // Oyuncu onayı
      await target
        .send({
          content:
            `📄 **SÖZLEŞME TEKLİFİ**\n\n` +
            `🏟️ Takım: ${team.name}\n` +
            `💰 Bonservis: ${para(
              fee
            )}\n` +
            `💵 Maaş: ${para(
              salary
            )}\n` +
            `📜 Sözleşme: ${duration}\n\n` +
            `Teklifi kabul etmek için aşağıdaki butona bas.`,
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(
                  `oyuncu_kabul_${id}`
                )
                .setLabel(
                  "✅ Kabul Et"
                )
                .setStyle(
                  ButtonStyle.Success
                ),

              new ButtonBuilder()
                .setCustomId(
                  `oyuncu_red_${id}`
                )
                .setLabel(
                  "❌ Reddet"
                )
                .setStyle(
                  ButtonStyle.Danger
                )
            )
          ]
        })
        .catch(
          () => {}
        );

      return message.reply(
        "📄 Sözleşme oluşturuldu. Gerekli onaylar bekleniyor."
      );
    }

    // =================================================
    // SÖZLEŞME
    // =================================================

    if (
      command === ".sözleşme"
    ) {
      const contract =
        Object.values(
          db.contracts
        ).find(
          x =>
            x.player ===
            message.author.id
        );

      if (!contract) {
        return message.reply(
          "📄 Bekleyen sözleşmen yok."
        );
      }

      return message.reply(
        `📄 **Bekleyen Sözleşme**\n\n` +
        `🏟️ Takım: ${contract.newTeam}\n` +
        `💰 Bonservis: ${para(
          contract.fee
        )}\n` +
        `💵 Maaş: ${para(
          contract.salary
        )}\n` +
        `📜 Süre: ${contract.duration}`
      );
    }

    // =================================================
    // SÖZLEŞME İPTAL
    // =================================================

    if (
      command === ".sözleşmeiptal"
    ) {
      const id =
        Object.keys(
          db.contracts
        ).find(
          x =>
            db.contracts[x]
              .player ===
            message.author.id
        );

      if (!id) {
        return message.reply(
          "❌ Bekleyen sözleşmen yok."
        );
      }

      delete db.contracts[id];

      saveData();

      return message.reply(
        "❌ Bekleyen sözleşme iptal edildi."
      );
    }

    // =================================================
    // BÜTÇE
    // =================================================

    if (
      command === ".bütçe"
    ) {
      const p =
        oyuncuVerisi(
          message.author.id
        );

      return message.reply(
        `💰 Kişisel bütçen: **${para(
          p.personalBudget
        )}**`
      );
    }

    // =================================================
    // BÜTÇE VER / AL
    // =================================================

    if (
      command === ".bütçever" ||
      command === ".bütçeal"
    ) {
      if (
        !yonetici(
          message.member
        )
      ) {
        return message.reply(
          "❌ Yönetici yetkisi gerekli."
        );
      }

      const target =
        message.mentions.users.first();

      const amount =
        paraCevir(args[1]);

      if (
        !target ||
        !Number.isFinite(amount)
      ) {
        return message.reply(
          `❌ Kullanım: \`${command} @oyuncu 5M\``
        );
      }

      const p =
        oyuncuVerisi(
          target.id
        );

      if (
        command === ".bütçever"
      ) {
        p.personalBudget +=
          amount;
      } else {
        p.personalBudget =
          Math.max(
            0,
            p.personalBudget -
              amount
          );
      }

      saveData();

      return message.reply(
        `💰 ${target} yeni bütçesi: **${para(
          p.personalBudget
        )}**`
      );
    }

    // =================================================
    // TAKIM BÜTÇESİ
    // =================================================

    if (
      command === ".takımbütçesi"
    ) {
      const team =
        oyuncununTakimi(
          message.author.id
        );

      if (!team) {
        return message.reply(
          "❌ Bir takımın yok."
        );
      }

      return message.reply(
        `🏦 **${team.name}** takım bütçesi: **${para(
          team.budget
        )}**`
      );
    }

    // =================================================
    // TAKIM BÜTÇE VER / AL
    // =================================================

    if (
      command === ".takımbütçever" ||
      command === ".takımbütçeal"
    ) {
      if (
        !yonetici(
          message.member
        )
      ) {
        return message.reply(
          "❌ Yönetici yetkisi gerekli."
        );
      }

      const amount =
        paraCevir(
          args[args.length - 1]
        );

      const teamName =
        args
          .slice(0, -1)
          .join(" ");

      const team =
        db.teams[teamName];

      if (
        !team ||
        !Number.isFinite(amount)
      ) {
        return message.reply(
          "❌ Kullanım: `.takımbütçever Takım Adı 10M`"
        );
      }

      if (
        command ===
        ".takımbütçever"
      ) {
        team.budget +=
          amount;
      } else {
        team.budget =
          Math.max(
            0,
            team.budget -
              amount
          );
      }

      saveData();

      return message.reply(
        `🏦 **${team.name}** bütçesi: **${para(
          team.budget
        )}**`
      );
    }

    // =================================================
    // BÜTÇELER
    // =================================================

    if (
      command === ".bütçeler"
    ) {
      const teams =
        Object.values(
          db.teams
        );

      if (!teams.length) {
        return message.reply(
          "❌ Henüz takım yok."
        );
      }

      return message.reply(
        teams
          .map(
            (t, i) =>
              `**${i + 1}. ${t.name}** — ${para(
                t.budget
              )}`
          )
          .join("\n")
      );
    }

    // =================================================
    // PUAN DURUMU
    // =================================================

    if (
      command === ".fikstür" ||
      command === ".puan" ||
      command === ".lig"
    ) {
      const teams =
        Object.values(
          db.teams
        ).sort(
          (a, b) =>
            b.stats.p -
              a.stats.p ||
            (b.stats.ag -
              b.stats.yg) -
              (a.stats.ag -
                a.stats.yg)
        );

      if (!teams.length) {
        return message.reply(
          "❌ Henüz takım yok."
        );
      }

      const text =
        teams
          .map(
            (t, i) =>
              `**${i + 1}. ${t.name}** | O:${t.stats.o} G:${t.stats.g} B:${t.stats.b} M:${t.stats.m} AG:${t.stats.ag} YG:${t.stats.yg} AV:${t.stats.ag - t.stats.yg} P:${t.stats.p}`
          )
          .join("\n");

      const embed =
        new EmbedBuilder()
          .setTitle(
            "🏆 UNITED LEAGUE"
          )
          .setDescription(
            text
          )
          .setTimestamp();

      return message.reply({
        embeds: [embed]
      });
    }

    // =================================================
    // PROFİL
    // =================================================

    if (
      command === ".profil"
    ) {
      const target =
        message.mentions.users.first() ||
        message.author;

      const p =
        oyuncuVerisi(
          target.id
        );

      const team =
        oyuncununTakimi(
          target.id
        );

      const embed =
        new EmbedBuilder()
          .setTitle(
            `👤 ${target.username} — PROFİL`
          )
          .addFields(
            {
              name: "🏟️ Takım",
              value:
                team?.name ||
                "Serbest",
              inline: true
            },
            {
              name: "💎 Değer",
              value:
                para(p.value),
              inline: true
            },
            {
              name: "💰 Bütçe",
              value:
                para(
                  p.personalBudget
                ),
              inline: true
            },
            {
              name: "⚽ Gol",
              value:
                String(
                  p.goals
                ),
              inline: true
            },
            {
              name: "🎯 Asist",
              value:
                String(
                  p.assists
                ),
              inline: true
            },
            {
              name: "🏋️ Antrenman",
              value:
                `${p.training}/10`,
              inline: true
            },
            {
              name: "🥅 Penaltı",
              value:
                `${p.penaltyGoals}/${p.penalties}`,
              inline: true
            }
          );

      return message.reply({
        embeds: [embed]
      });
    }

    // =================================================
    // TAKIM PROFİL
    // =================================================

    if (
      command === ".takımprofil"
    ) {
      const team =
        db.teams[
          args.join(" ")
        ] ||
        oyuncununTakimi(
          message.author.id
        );

      if (!team) {
        return message.reply(
          "❌ Takım bulunamadı."
        );
      }

      const s =
        team.stats;

      const embed =
        new EmbedBuilder()
          .setTitle(
            `🏟️ ${team.name}`
          )
          .setDescription(
            `👔 Teknik Direktör: ${etiket(
              team.td
            )}\n\n` +
            `💰 Bütçe: **${para(
              team.budget
            )}**\n` +
            `📋 Formasyon: **${team.formation}**\n` +
            `👥 Kadro: **${team.squad.length}**\n` +
            `🏆 Puan: **${s.p}**\n` +
            `⚽ Gol: **${s.ag}**\n` +
            `🥅 Yenen Gol: **${s.yg}**`
          );

      return message.reply({
        embeds: [embed]
      });
    }

    // =================================================
    // GOL KRALLIĞI
    // =================================================

    if (
      command === ".golkrallığı"
    ) {
      const players =
        Object.entries(
          db.players
        )
          .sort(
            (a, b) =>
              b[1].goals -
              a[1].goals
          )
          .slice(0, 10);

      if (!players.length) {
        return message.reply(
          "❌ Henüz istatistik yok."
        );
      }

      return message.reply(
        players
          .map(
            ([id, p], i) =>
              `**${i + 1}.** ${etiket(
                id
              )} — ⚽ ${p.goals}`
          )
          .join("\n")
      );
    }

    // =================================================
    // ASİST KRALLIĞI
    // =================================================

    if (
      command === ".asistkrallığı"
    ) {
      const players =
        Object.entries(
          db.players
        )
          .sort(
            (a, b) =>
              b[1].assists -
              a[1].assists
          )
          .slice(0, 10);

      if (!players.length) {
        return message.reply(
          "❌ Henüz istatistik yok."
        );
      }

      return message.reply(
        players
          .map(
            ([id, p], i) =>
              `**${i + 1}.** ${etiket(
                id
              )} — 🎯 ${p.assists}`
          )
          .join("\n")
      );
    }

    // =================================================
    // MAÇ
    // =================================================

    if (
      command === ".maç"
    ) {
      if (
        !yonetici(
          message.member
        )
      ) {
        return message.reply(
          "❌ Maç yetkin yok."
        );
      }

      if (args.length < 2) {
        return message.reply(
          "❌ Kullanım: `.maç Takım1 Takım2`"
        );
      }

      const homeName =
        args[0];

      const awayName =
        args
          .slice(1)
          .join(" ");

      const home =
        db.teams[homeName];

      const away =
        db.teams[awayName];

      if (!home || !away) {
        return message.reply(
          "❌ Takımlardan biri bulunamadı."
        );
      }

      if (
        home.name ===
        away.name
      ) {
        return message.reply(
          "❌ Bir takım kendisiyle maç yapamaz."
        );
      }

      await message.channel.send(
        `⚽ **MAÇ BAŞLIYOR!**\n\n🏟️ **${home.name}** 🆚 **${away.name}**`
      );

      let scoreHome = 0;
      let scoreAway = 0;

      const olaylar = [
        "⚡ Orta saha mücadelesi",
        "🔥 Tehlikeli atak!",
        "🎯 Şut çekildi!",
        "🧤 Kaleci kurtardı!",
        "⚽ Gol pozisyonu!",
        "🚨 Savunma hata yaptı!",
        "🏃 Hızlı hücum!",
        "🎯 Direkten döndü!"
      ];

      for (
        let dakika = 1;
        dakika <= 5;
        dakika++
      ) {
        await new Promise(
          resolve =>
            setTimeout(
              resolve,
              1000
            )
        );

        const olay =
          olaylar[
            Math.floor(
              Math.random() *
                olaylar.length
            )
          ];

        if (
          Math.random() <
          0.25
        ) {
          if (
            Math.random() <
            0.5
          ) {
            scoreHome++;

            await message.channel.send(
              `⏱️ **${dakika}'** ⚽ **GOL!** ${home.name}\n📊 ${scoreHome}-${scoreAway}`
            );
          } else {
            scoreAway++;

            await message.channel.send(
              `⏱️ **${dakika}'** ⚽ **GOL!** ${away.name}\n📊 ${scoreHome}-${scoreAway}`
            );
          }
        } else {
          await message.channel.send(
            `⏱️ **${dakika}'** ${olay}`
          );
        }
      }

      home.stats.o++;
      away.stats.o++;

      home.stats.ag +=
        scoreHome;
      home.stats.yg +=
        scoreAway;

      away.stats.ag +=
        scoreAway;
      away.stats.yg +=
        scoreHome;

      if (
        scoreHome >
        scoreAway
      ) {
        home.stats.g++;
        home.stats.p += 3;
        away.stats.m++;
      } else if (
        scoreAway >
        scoreHome
      ) {
        away.stats.g++;
        away.stats.p += 3;
        home.stats.m++;
      } else {
        home.stats.b++;
        away.stats.b++;
        home.stats.p++;
        away.stats.p++;
      }

      const mac = {
        home: home.name,
        away: away.name,
        score1: scoreHome,
        score2: scoreAway,
        date:
          new Date().toISOString()
      };

      db.matches.push(mac);

      saveData();

      const embed =
        new EmbedBuilder()
          .setTitle(
            "🏁 MAÇ SONA ERDİ"
          )
          .setDescription(
            `🏟️ **${home.name}**\n\n` +
            `# ${scoreHome} - ${scoreAway}\n\n` +
            `**${away.name}**`
          )
          .setTimestamp();

      await message.channel.send({
        embeds: [embed]
      });

      await log(
        message.guild,
        "maclar",
        `⚽ ${home.name} ${scoreHome}-${scoreAway} ${away.name}`
      );
    }

    // =================================================
    // MAÇ GEÇMİŞİ
    // =================================================

    if (
      command === ".maçlar" ||
      command === ".maçgeçmişi" ||
      command === ".sonuçlar"
    ) {
      const matches =
        db.matches.slice(-10);

      if (!matches.length) {
        return message.reply(
          "❌ Maç geçmişi yok."
        );
      }

      return message.reply(
        matches
          .map(
            m =>
              `⚽ **${m.home} ${m.score1}-${m.score2} ${m.away}**`
          )
          .join("\n")
      );
    }

    // =================================================
    // İSTATİSTİK
    // =================================================

    if (
      command === ".istatistik"
    ) {
      const p =
        oyuncuVerisi(
          message.author.id
        );

      return message.reply(
        `📊 **İSTATİSTİKLERİN**\n\n` +
        `⚽ Gol: **${p.goals}**\n` +
        `🎯 Asist: **${p.assists}**\n` +
        `🥅 Penaltı: **${p.penaltyGoals}/${p.penalties}**\n` +
        `🧤 Kurtarış: **${p.saves}**\n` +
        `🏋️ Antrenman: **${p.training}/10**`
      );
    }

    // =================================================
    // ÇEKİLİŞ
    // =================================================

    if (
      command === ".çekiliş"
    ) {
      if (
        !yonetici(
          message.member
        )
      ) {
        return message.reply(
          "❌ Çekiliş yetkin yok."
        );
      }

      const prize =
        paraCevir(args[0]);

      const time =
        args[1];

      if (
        !Number.isFinite(
          prize
        ) ||
        !time
      ) {
        return message.reply(
          "❌ Kullanım: `.çekiliş 30M 1s`"
        );
      }

      const match =
        time.match(
          /^(\d+)(sn|s|dk|m|sa|h|g|d)$/i
        );

      if (!match) {
        return message.reply(
          "❌ Süre: `30sn`, `5dk`, `1s`, `2sa` gibi olmalı."
        );
      }

      const number =
        Number(match[1]);

      const unit =
        match[2].toLowerCase();

      const multipliers = {
        sn: 1000,
        s: 1000,
        dk: 60000,
        m: 60000,
        sa: 3600000,
        h: 3600000,
        g: 86400000,
        d: 86400000
      };

      const duration =
        number *
        multipliers[unit];

      const id =
        Date.now().toString();

      const end =
        Date.now() +
        duration;

      db.giveaways[id] = {
        id,
        prize,
        channel:
          message.channel.id,
        end,
        users: []
      };

      saveData();

      const embed =
        new EmbedBuilder()
          .setTitle(
            "🎁 UNITED LEAGUE ÇEKİLİŞ"
          )
          .setDescription(
            `💰 Ödül: **${para(
              prize
            )}**\n\n` +
            `🎉 Katılmak için butona bas!\n\n` +
            `⏰ Bitiş: <t:${Math.floor(
              end / 1000
            )}:R>`
          )
          .setTimestamp();

      const msg =
        await message.channel.send({
          embeds: [embed],
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(
                  `cekilis_${id}`
                )
                .setLabel(
                  "🎉 Katıl"
                )
                .setStyle(
                  ButtonStyle.Success
                )
            )
          ]
        });

      setTimeout(
        async () => {
          const giveaway =
            db.giveaways[id];

          if (!giveaway)
            return;

          const users =
            giveaway.users;

          if (users.length) {
            const winner =
              users[
                Math.floor(
                  Math.random() *
                    users.length
                )
              ];

            const p =
              oyuncuVerisi(
                winner
              );

            p.personalBudget +=
              prize;

            await message.channel.send(
              `🎉 Çekilişi ${etiket(
                winner
              )} kazandı!\n💰 Ödül: **${para(
                prize
              )}**`
            );
          } else {
            await message.channel.send(
              "🎁 Çekilişe katılan olmadı."
            );
          }

          delete db.giveaways[
            id
          ];

          saveData();

          await msg
            .edit({
              components: []
            })
            .catch(() => {});
        },
        Math.min(
          duration,
          2147483647
        )
      );
    }

    // =================================================
    // SİL
    // =================================================

    if (
      command === ".sil"
    ) {
      if (
        !moderator(
          message.member
        )
      ) {
        return message.reply(
          "❌ Moderasyon yetkin yok."
        );
      }

      let amount =
        Number(args[0]);

      if (
        !Number.isFinite(
          amount
        )
      ) {
        amount = 1;
      }

      amount =
        Math.max(
          1,
          Math.min(
            1000,
            amount
          )
        );

      await message.channel
        .bulkDelete(
          amount + 1,
          true
        )
        .catch(() => {});

      return;
    }

    // =================================================
    // KICK
    // =================================================

    if (
      command === ".kick"
    ) {
      if (
        !moderator(
          message.member
        )
      ) {
        return message.reply(
          "❌ Moderasyon yetkin yok."
        );
      }

      const target =
        message.mentions.members.first();

      if (!target) {
        return message.reply(
          "❌ Oyuncu belirt."
        );
      }

      await target
        .kick()
        .catch(() => {});

      await log(
        message.guild,
        "moderasyonLog",
        `👢 Kick: ${target.user.tag} | Yetkili: ${message.author.tag}`
      );

      return message.reply(
        `✅ ${target} sunucudan atıldı.`
      );
    }

    // =================================================
    // BAN
    // =================================================

    if (
      command === ".ban"
    ) {
      if (
        !moderator(
          message.member
        )
      ) {
        return message.reply(
          "❌ Moderasyon yetkin yok."
        );
      }

      const target =
        message.mentions.members.first();

      if (!target) {
        return message.reply(
          "❌ Oyuncu belirt."
        );
      }

      await target
        .ban()
        .catch(() => {});

      await log(
        message.guild,
        "moderasyonLog",
        `🔨 Ban: ${target.user.tag} | Yetkili: ${message.author.tag}`
      );

      return message.reply(
        `✅ ${target} banlandı.`
      );
    }

    // =================================================
    // MUTE
    // =================================================

    if (
      command === ".mute"
    ) {
      if (
        !moderator(
          message.member
        )
      ) {
        return message.reply(
          "❌ Moderasyon yetkin yok."
        );
      }

      const target =
        message.mentions.members.first();

      if (!target) {
        return message.reply(
          "❌ Oyuncu belirt."
        );
      }

      await target
        .timeout(
          28 * 24 * 60 * 60 * 1000
        )
        .catch(() => {});

      return message.reply(
        `🔇 ${target} susturuldu.`
      );
    }

    // =================================================
    // UNMUTE
    // =================================================

    if (
      command === ".unmute"
    ) {
      if (
        !moderator(
          message.member
        )
      ) {
        return message.reply(
          "❌ Moderasyon yetkin yok."
        );
      }

      const target =
        message.mentions.members.first();

      if (!target) {
        return message.reply(
          "❌ Oyuncu belirt."
        );
      }

      await target
        .timeout(null)
        .catch(() => {});

      return message.reply(
        `🔊 ${target} susturması kaldırıldı.`
      );
    }

    // =================================================
    // UYAR
    // =================================================

    if (
      command === ".uyar"
    ) {
      if (
        !moderator(
          message.member
        )
      ) {
        return message.reply(
          "❌ Moderasyon yetkin yok."
        );
      }

      const target =
        message.mentions.users.first();

      const reason =
        args
          .slice(1)
          .join(" ") ||
        "Sebep belirtilmedi.";

      if (!target) {
        return message.reply(
          "❌ Oyuncu belirt."
        );
      }

      if (
        !db.warnings[
          target.id
        ]
      ) {
        db.warnings[
          target.id
        ] = [];
      }

      db.warnings[
        target.id
      ].push({
        reason,
        by:
          message.author.id,
        date:
          new Date().toISOString()
      });

      saveData();

      await log(
        message.guild,
        "moderasyonLog",
        `⚠️ Uyarı: ${target.tag}\nSebep: ${reason}\nYetkili: ${message.author.tag}`
      );

      return message.reply(
        `⚠️ ${target} uyarıldı.\nSebep: ${reason}`
      );
    }

    // =================================================
    // SİCİL
    // =================================================

    if (
      command === ".sicil"
    ) {
      if (
        !moderator(
          message.member
        )
      ) {
        return message.reply(
          "❌ Moderasyon yetkin yok."
        );
      }

      const target =
        message.mentions.users.first() ||
        message.author;

      const warnings =
        db.warnings[
          target.id
        ] || [];

      if (!warnings.length) {
        return message.reply(
          "📋 Sicili temiz."
        );
      }

      return message.reply(
        warnings
          .map(
            (w, i) =>
              `**${i + 1}.** ${w.reason} — <@${w.by}>`
          )
          .join("\n")
      );
    }

    // =================================================
    // KİLİT
    // =================================================

    if (
      command === ".kilit"
    ) {
      if (
        !yonetici(
          message.member
        )
      ) {
        return message.reply(
          "❌ Yönetici yetkisi gerekli."
        );
      }

      await message.channel.permissionOverwrites.edit(
        message.guild.roles.everyone,
        {
          SendMessages: false
        }
      );

      return message.reply(
        "🔒 Kanal kilitlendi."
      );
    }

    // =================================================
    // AÇ
    // =================================================

    if (
      command === ".aç"
    ) {
      if (
        !yonetici(
          message.member
        )
      ) {
        return message.reply(
          "❌ Yönetici yetkisi gerekli."
        );
      }

      await message.channel.permissionOverwrites.edit(
        message.guild.roles.everyone,
        {
          SendMessages: true
        }
      );

      return message.reply(
        "🔓 Kanal açıldı."
      );
    }

    // =================================================
    // DM
    // =================================================

    if (
      command === ".dm"
    ) {
      if (
        !yonetici(
          message.member
        )
      ) {
        return message.reply(
          "❌ Yönetici yetkisi gerekli."
    
