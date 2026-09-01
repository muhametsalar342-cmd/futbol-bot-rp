const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  ActivityType
} = require("discord.js");

const fs = require("fs");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences
  ],
  partials: [Partials.Channel, Partials.Message, Partials.User]
});

// ======================================================
// AYARLAR
// ======================================================

const PREFIX = ".";

const ROLES = {
  YONETICI: "1544449436011339806",
  KAYIT: "1544452022764568656",
  DEGER: "1544451743746891806",
  MOD: "1544450307088715917",
  TD: "1544452323450032229",
  OYUNCU: "1544452779156709516",
  KAYITSIZ: process.env.KAYITSIZ_ROLE_ID || "KAYITSIZ_ROLE_ID"
};

const CHANNELS = {};

let data = {
  users: {},
  teams: {},
  usedTeams: [],
  matches: [],
  contracts: [],
  transfers: [],
  valueLogs: [],
  budgetLogs: [],
  moderationLogs: [],
  giveaways: [],
  sponsors: {},
  companies: {},
  registrations: [],
  channels: {}
};

if (fs.existsSync("./data.json")) {
  try {
    data = JSON.parse(fs.readFileSync("./data.json", "utf8"));
  } catch {
    console.log("data.json okunamadı, yeni veri oluşturuluyor.");
  }
}

function save() {
  fs.writeFileSync("./data.json", JSON.stringify(data, null, 2));
}

function ensureUser(id) {
  if (!data.users[id]) {
    data.users[id] = {
      budget: 0,
      value: 0,
      training: 0,
      goals: 0,
      assists: 0,
      penalties: {
        total: 0,
        goals: 0,
        misses: 0
      },
      yellow: 0,
      red: 0,
      team: null,
      contract: null,
      transfers: [],
      warnings: []
    };
  }

  return data.users[id];
}

function isAdmin(member) {
  return member.roles.cache.has(ROLES.YONETICI) ||
    member.permissions.has(PermissionsBitField.Flags.Administrator);
}

function isModerator(member) {
  return isAdmin(member) || member.roles.cache.has(ROLES.MOD);
}

function hasRole(member, roleId) {
  return member.roles.cache.has(roleId);
}

function moneyToNumber(value) {
  if (!value) return 0;

  let v = String(value)
    .toLowerCase()
    .replace(/€/g, "")
    .replace(/\s/g, "")
    .replace(/,/g, "");

  if (v.endsWith("m")) {
    return parseFloat(v) * 1000000;
  }

  if (v.endsWith("k")) {
    return parseFloat(v) * 1000;
  }

  return Number(v) || 0;
}

function money(value) {
  value = Math.max(0, Number(value) || 0);

  if (value >= 1000000) {
    return `${Number((value / 1000000).toFixed(2))}M€`;
  }

  if (value >= 1000) {
    return `${Number((value / 1000).toFixed(2))}K€`;
  }

  return `${value}€`;
}

function parseDuration(text) {
  const match = String(text).toLowerCase().match(/^(\d+)(s|m|h|d)$/);

  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2];

  if (unit === "s") return amount * 1000;
  if (unit === "m") return amount * 60 * 1000;
  if (unit === "h") return amount * 60 * 60 * 1000;
  if (unit === "d") return amount * 24 * 60 * 60 * 1000;

  return null;
}

function embed(title, description) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

async function logTo(guild, type, message) {
  const channelId = data.channels?.logs?.[type];

  if (!channelId) return;

  const channel = guild.channels.cache.get(channelId);

  if (channel) {
    await channel.send({
      embeds: [
        embed(`📋 ${type.toUpperCase()} LOG`, message)
      ]
    }).catch(() => {});
  }
}

// ======================================================
// TAKIMLAR
// ======================================================

const REAL_TEAMS = [
  "Real Madrid",
  "Barcelona",
  "Atlético Madrid",
  "Manchester City",
  "Manchester United",
  "Liverpool",
  "Arsenal",
  "Chelsea",
  "Tottenham Hotspur",
  "Bayern Munich",
  "Borussia Dortmund",
  "Bayer Leverkusen",
  "Paris Saint-Germain",
  "Olympique de Marseille",
  "Juventus",
  "Inter Milan",
  "AC Milan",
  "Napoli",
  "Roma",
  "Lazio",
  "Ajax",
  "PSV Eindhoven",
  "Feyenoord",
  "Galatasaray",
  "Fenerbahçe",
  "Beşiktaş",
  "Trabzonspor",
  "Benfica",
  "Porto",
  "Sporting CP",
  "Monaco",
  "Sevilla",
  "Valencia",
  "Villarreal"
];

// ======================================================
// ŞİRKETLER
// ======================================================

const COMPANIES = [
  { name: "Adidas", income: 5000000, duration: "30 gün" },
  { name: "Nike", income: 6000000, duration: "30 gün" },
  { name: "Puma", income: 4000000, duration: "30 gün" },
  { name: "Emirates", income: 7000000, duration: "30 gün" },
  { name: "Qatar Airways", income: 7500000, duration: "30 gün" },
  { name: "Coca-Cola", income: 4500000, duration: "30 gün" },
  { name: "Pepsi", income: 4000000, duration: "30 gün" },
  { name: "Samsung", income: 6500000, duration: "30 gün" },
  { name: "Sony", income: 5500000, duration: "30 gün" },
  { name: "Microsoft", income: 7000000, duration: "30 gün" },
  { name: "Apple", income: 8000000, duration: "30 gün" },
  { name: "Red Bull", income: 5000000, duration: "30 gün" },
  { name: "Visa", income: 6000000, duration: "30 gün" },
  { name: "Mastercard", income: 6000000, duration: "30 gün" }
];

const SPONSORS = [
  { name: "Global Energy", income: 3000000 },
  { name: "United Bank", income: 4000000 },
  { name: "Prime Telecom", income: 3500000 },
  { name: "World Sports", income: 2500000 },
  { name: "Elite Motors", income: 4500000 },
  { name: "Future Tech", income: 5000000 }
];

// ======================================================
// LİG TABLOSU
// ======================================================

function getStandings() {
  const teams = Object.values(data.teams);

  return teams.sort((a, b) => {
    if ((b.points || 0) !== (a.points || 0)) {
      return (b.points || 0) - (a.points || 0);
    }

    const avA = (a.gf || 0) - (a.ga || 0);
    const avB = (b.gf || 0) - (b.ga || 0);

    return avB - avA;
  });
}

// ======================================================
// BOT HAZIR
// ======================================================

client.once("ready", () => {
  console.log(`${client.user.tag} aktif!`);

  client.user.setPresence({
    activities: [
      {
        name: "United League ⚽",
        type: ActivityType.Watching
      }
    ],
    status: "online"
  });
});

// ======================================================
// SUNUCUYA YENİ ÜYE
// ======================================================

client.on("guildMemberAdd", async member => {
  ensureUser(member.id);
  save();

  const channel = member.guild.channels.cache.find(
    c => c.name === "gelen-giden"
  );

  if (channel) {
    channel.send({
      embeds: [
        embed(
          "👋 Yeni Oyuncu",
          `${member} sunucuya katıldı!\n\nKayıt olmak için kayıt kanalını kullanabilirsin.`
        )
      ]
    });
  }
});

// ======================================================
// SUNUCU KUR
// ======================================================

async function createTextChannel(guild, category, name, overwrites = []) {
  const channel = await guild.channels.create({
    name,
    type: ChannelType.GuildText,
    parent: category.id,
    permissionOverwrites: overwrites
  });

  return channel;
}

client.on("messageCreate", async message => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  // ====================================================
  // SUNUCU KUR
  // ====================================================

  if (command === "sunucukur") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Bu komutu sadece yöneticiler kullanabilir.");
    }

    await message.reply("⏳ United League sunucusu kuruluyor...");

    const everyone = message.guild.roles.everyone;

    const ana = await message.guild.channels.create({
      name: "📁 UNITED LEAGUE",
      type: ChannelType.GuildCategory
    });

    const kayit = await message.guild.channels.create({
      name: "📁 KAYIT",
      type: ChannelType.GuildCategory
    });

    const takim = await message.guild.channels.create({
      name: "📁 TAKIM & KADRO",
      type: ChannelType.GuildCategory
    });

    const transfer = await message.guild.channels.create({
      name: "📁 TRANSFER",
      type: ChannelType.GuildCategory
    });

    const ekonomi = await message.guild.channels.create({
      name: "📁 EKONOMİ",
      type: ChannelType.GuildCategory
    });

    const medya = await message.guild.channels.create({
      name: "📁 MEDYA",
      type: ChannelType.GuildCategory
    });

    const yetkili = await message.guild.channels.create({
      name: "📁 YETKİLİ",
      type: ChannelType.GuildCategory
    });

    const sohbet = await message.guild.channels.create({
      name: "📁 SOHBET",
      type: ChannelType.GuildCategory
    });

    const kayitsizOverwrites = [
      {
        id: everyone.id,
        deny: [PermissionsBitField.Flags.ViewChannel]
      },
      {
        id: ROLES.KAYITSIZ,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory
        ]
      },
      {
        id: ROLES.YONETICI,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory
        ]
      },
      {
        id: ROLES.KAYIT,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory
        ]
      }
    ];

    const normal = [
      {
        id: everyone.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.ReadMessageHistory
        ]
      }
    ];

    const ch = {};

    ch.duyurular = await createTextChannel(
      message.guild,
      ana,
      "📢・duyurular",
      normal
    );

    ch.sohbet = await createTextChannel(
      message.guild,
      ana,
      "💬・sohbet",
      normal
    );

    ch.gelen = await createTextChannel(
      message.guild,
      ana,
      "👋・gelen-giden",
      normal
    );

    ch.kurallar = await createTextChannel(
      message.guild,
      ana,
      "📜・kurallar",
      normal
    );

    ch.kayit = await createTextChannel(
      message.guild,
      kayit,
      "📝・kayıt",
      kayitsizOverwrites
    );

    ch.kayitlog = await createTextChannel(
      message.guild,
      kayit,
      "📋・kayıt-log",
      [
        {
          id: everyone.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: ROLES.YONETICI,
          allow: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: ROLES.KAYIT,
          allow: [PermissionsBitField.Flags.ViewChannel]
        }
      ]
    );

    ch.takimlar = await createTextChannel(
      message.guild,
      takim,
      "🏟️・takımlar",
      normal
    );

    ch.kadrolar = await createTextChannel(
      message.guild,
      takim,
      "👥・kadrolar",
      normal
    );

    ch.puan = await createTextChannel(
      message.guild,
      takim,
      "📊・puan-durumu",
      normal
    );

    ch.fikstur = await createTextChannel(
      message.guild,
      takim,
      "📅・fikstür",
      normal
    );

    ch.maclar = await createTextChannel(
      message.guild,
      takim,
      "⚽・maçlar",
      normal
    );

    ch.transfer = await createTextChannel(
      message.guild,
      transfer,
      "🔄・transfer",
      normal
    );

    ch.sozlesmeler = await createTextChannel(
      message.guild,
      transfer,
      "📜・sözleşmeler",
      normal
    );

    ch.transferlog = await createTextChannel(
      message.guild,
      transfer,
      "💰・transfer-log",
      normal
    );

    ch.butceler = await createTextChannel(
      message.guild,
      ekonomi,
      "💵・bütçeler",
      normal
    );

    ch.degerler = await createTextChannel(
      message.guild,
      ekonomi,
      "💎・değerler",
      normal
    );

    ch.sponsorlar = await createTextChannel(
      message.guild,
      ekonomi,
      "🤝・sponsorlar",
      normal
    );

    ch.sirketler = await createTextChannel(
      message.guild,
      ekonomi,
      "🏢・şirketler",
      normal
    );

    ch.haberler = await createTextChannel(
      message.guild,
      medya,
      "📰・haberler",
      normal
    );

    ch.tweetler = await createTextChannel(
      message.guild,
      medya,
      "🐦・tweetler",
      normal
    );

    ch.transferduyuru = await createTextChannel(
      message.guild,
      medya,
      "📸・transfer-duyuruları",
      normal
    );

    ch.yetkilisohbet = await createTextChannel(
      message.guild,
      yetkili,
      "🔐・yetkili-sohbet",
      [
        {
          id: everyone.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: ROLES.YONETICI,
          allow: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: ROLES.MOD,
          allow: [PermissionsBitField.Flags.ViewChannel]
        }
      ]
    );

    ch.yetkililog = await createTextChannel(
      message.guild,
      yetkili,
      "📋・yetkili-log",
      normal
    );

    ch.moderasyonlog = await createTextChannel(
      message.guild,
      yetkili,
      "🛡️・moderasyon-log",
      normal
    );

    ch.cekiliselog = await createTextChannel(
      message.guild,
      yetkili,
      "🎁・çekiliş-log",
      normal
    );

    // ÖZEL SOHBET KATEGORİSİ
    ch.ozelSohbet = await createTextChannel(
      message.guild,
      sohbet,
      "💬・sohbet",
      normal
    );

    ch.botKomut = await createTextChannel(
      message.guild,
      sohbet,
      "🤖・bot-komut",
      normal
    );

    ch.gorsel = await createTextChannel(
      message.guild,
      sohbet,
      "🖼️・görsel",
      normal
    );

    data.channels = {
      ...ch,
      logs: {
        kayıt: ch.kayitlog.id,
        transfer: ch.transferlog.id,
        moderasyon: ch.moderasyonlog.id,
        çekiliş: ch.cekiliselog.id
      }
    };

    save();

    await ch.kayit.send({
      embeds: [
        embed(
          "📝 UNITED LEAGUE KAYIT",
          "Sunucuya kayıt olmak için aşağıdaki butonlardan birine bas."
        )
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("register_player")
            .setLabel("Futbolcu")
            .setEmoji("⚽")
            .setStyle(ButtonStyle.Success),

          new ButtonBuilder()
            .setCustomId("register_td")
            .setLabel("Teknik Direktör")
            .setEmoji("👔")
            .setStyle(ButtonStyle.Primary)
        )
      ]
    });

    await ch.kurallar.send({
      embeds: [
        embed(
          "📜 UNITED LEAGUE KURALLARI",
          "• Saygılı olun.\n• Yetkililere saygısızlık yapmayın.\n• RP düzenini bozmayın.\n• Hile ve spam yasaktır.\n• Transfer sistemini kurallara uygun kullanın.\n• Gereksiz etiket kullanmayın."
        )
      ]
    });

    return;
  }

  // ====================================================
  // KAYIT
  // ====================================================

  if (command === "k") {
    if (!hasRole(message.member, ROLES.KAYIT) && !isAdmin(message.member)) {
      return message.reply("❌ Kayıt yetkilisi değilsin.");
    }

    const user = message.mentions.members.first();

    if (!user) {
      return message.reply("❌ Kullanıcı etiketle.");
    }

    const name = args.slice(1).join(" ");

    if (!name) {
      return message.reply("❌ Oyuncunun adını yaz.");
    }

    await message.channel.send({
      embeds: [
        embed(
          "📝 Kayıt İşlemi",
          `${user} için kayıt türünü seçin.\n\n**İsim:** ${name}`
        )
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`reg_player_${user.id}_${name}`)
            .setLabel("Futbolcu")
            .setEmoji("⚽")
            .setStyle(ButtonStyle.Success),

          new ButtonBuilder()
            .setCustomId(`reg_td_${user.id}_${name}`)
            .setLabel("Teknik Direktör")
            .setEmoji("👔")
            .setStyle(ButtonStyle.Primary)
        )
      ]
    });

    return;
  }

  // ====================================================
  // TAKIM KUR
  // ====================================================

  if (command === "takımkur") {
    if (!hasRole(message.member, ROLES.TD) && !isAdmin(message.member)) {
      return message.reply("❌ Sadece Teknik Direktörler takım kurabilir.");
    }

    const existing = Object.values(data.teams).find(
      t => t.td === message.author.id
    );

    if (existing) {
      return message.reply(
        `❌ Zaten **${existing.name}** takımının Teknik Direktörüsün.`
      );
    }

    const available = REAL_TEAMS.filter(
      team => !data.usedTeams.includes(team)
    );

    if (!available.length) {
      return message.reply("❌ Kullanılabilecek takım kalmadı.");
    }

    const options = available.slice(0, 25).map(team => ({
      label: team,
      value: team
    }));

    const menu = new StringSelectMenuBuilder()
      .setCustomId(`team_create_${message.author.id}`)
      .setPlaceholder("Bir takım seç")
      .addOptions(options);

    return message.reply({
      embeds: [
        embed(
          "🏟️ TAKIM KUR",
          "Aşağıdaki menüden gerçek bir futbol takımı seç."
        )
      ],
      components: [
        new ActionRowBuilder().addComponents(menu)
      ]
    });
  }

  // ====================================================
  // KADRO
  // ====================================================

  if (command === "kadro" || command === "kadrom") {
    const team = Object.values(data.teams).find(
      t => t.td === message.author.id
    );

    let targetTeam = team;

    if (!targetTeam && args.length) {
      targetTeam = Object.values(data.teams).find(
        t => t.name.toLowerCase() === args.join(" ").toLowerCase()
      );
    }

    if (!targetTeam) {
      return message.reply("❌ Takım bulunamadı.");
    }

    const players = targetTeam.squad || [];

    return message.reply({
      embeds: [
        embed(
          `👥 ${targetTeam.name} KADROSU`,
          players.length
            ? players.map((id, i) => `${i + 1}. <@${id}>`).join("\n")
            : "Henüz kadroda oyuncu bulunmuyor."
        ).addFields(
          {
            name: "📐 Formasyon",
            value: targetTeam.formation || "4-3-3",
            inline: true
          },
          {
            name: "👔 Teknik Direktör",
            value: targetTeam.td
              ? `<@${targetTeam.td}>`
              : "Boş",
            inline: true
          }
        )
      ]
    });
  }

  // ====================================================
  // KADRO EKLE
  // ====================================================

  if (command === "kadroekle") {
    const player = message.mentions.members.first();

    if (!player) {
      return message.reply("❌ Oyuncu etiketle.");
    }

    const team = Object.values(data.teams).find(
      t => t.td === message.author.id
    );

    if (!team) {
      return message.reply("❌ Bir takımın Teknik Direktörü değilsin.");
    }

    if (team.squad.includes(player.id)) {
      return message.reply("❌ Bu oyuncu zaten kadroda.");
    }

    const user = ensureUser(player.id);

    if (user.team !== team.name) {
      return message.reply(
        "❌ Bu oyuncu senin takımında değil. Önce transfer tamamlanmalı."
      );
    }

    team.squad.push(player.id);
    save();

    await logTo(
      message.guild,
      "transfer",
      `${player} **${team.name}** kadrosuna eklendi.`
    );

    return message.reply(`✅ ${player} kadroya eklendi.`);
  }

  // ====================================================
  // KADRO ÇIKAR
  // ====================================================

  if (command === "kadroçıkar") {
    const player = message.mentions.members.first();

    if (!player) {
      return message.reply("❌ Oyuncu etiketle.");
    }

    const team = Object.values(data.teams).find(
      t => t.td === message.author.id
    );

    if (!team) {
      return message.reply("❌ Takımın bulunamadı.");
    }

    team.squad = team.squad.filter(id => id !== player.id);
    save();

    return message.reply(`✅ ${player} kadrodan çıkarıldı.`);
  }

  // ====================================================
  // FORMASYON
  // ====================================================

  if (command === "formasyon") {
    const formations = [
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

    const formation = args[0];

    const team = Object.values(data.teams).find(
      t => t.td === message.author.id
    );

    if (!team) {
      return message.reply("❌ Takımın bulunamadı.");
    }

    if (!formations.includes(formation)) {
      return message.reply(
        `❌ Geçersiz formasyon.\n\n${formations.join("\n")}`
      );
    }

    team.formation = formation;
    save();

    return message.reply(
      `✅ **${team.name}** formasyonu **${formation}** olarak ayarlandı.`
    );
  }

  // ====================================================
  // DEĞER VER
  // ====================================================

  if (command === "dver") {
    if (!hasRole(message.member, ROLES.DEGER) && !isAdmin(message.member)) {
      return message.reply("❌ Değer yetkilisi değilsin.");
    }

    const player = message.mentions.members.first();
    const amount = moneyToNumber(args[1]);

    if (!player || amount <= 0) {
      return message.reply("❌ Kullanım: `.dver @oyuncu 5M`");
    }

    const user = ensureUser(player.id);

    const oldValue = user.value;
    user.value += amount;

    let nickname = player.nickname || player.user.username;

    const parts = nickname.split("|");

    if (parts.length >= 2) {
      parts[parts.length - 1] = ` ${money(user.value)}`;
      nickname = parts.join("|").trim();
    } else {
      nickname = `${nickname} | ${money(user.value)}`;
    }

    await player.setNickname(nickname).catch(() => {});

    data.valueLogs.push({
      user: player.id,
      type: "increase",
      amount,
      oldValue,
      newValue: user.value,
      by: message.author.id,
      date: Date.now()
    });

    save();

    return message.reply(
      `✅ ${player} değerine **${money(amount)}** eklendi.\n\nYeni değer: **${money(user.value)}**`
    );
  }

  // ====================================================
  // DEĞER SİL
  // ====================================================

  if (command === "dsil") {
    if (!hasRole(message.member, ROLES.DEGER) && !isAdmin(message.member)) {
      return message.reply("❌ Değer yetkilisi değilsin.");
    }

    const player = message.mentions.members.first();
    const amount = moneyToNumber(args[1]);

    if (!player || amount <= 0) {
      return message.reply("❌ Kullanım: `.dsil @oyuncu 5M`");
    }

    const user = ensureUser(player.id);

    user.value = Math.max(0, user.value - amount);

    const nickname = player.nickname || player.user.username;
    const parts = nickname.split("|");

    let newNickname;

    if (parts.length >= 2) {
      parts[parts.length - 1] = ` ${money(user.value)}`;
      newNickname = parts.join("|").trim();
    } else {
      newNickname = `${nickname} | ${money(user.value)}`;
    }

    await player.setNickname(newNickname).catch(() => {});

    save();

    return message.reply(
      `✅ ${player} değerinden **${money(amount)}** düşüldü.\nYeni değer: **${money(user.value)}**`
    );
  }

  // ====================================================
  // DEĞER
  // ====================================================

  if (command === "değer") {
    const player = message.mentions.members.first() || message.member;
    const user = ensureUser(player.id);

    return message.reply(
      `💎 **${player.user.username}**\n\nDeğer: **${money(user.value)}**`
    );
  }

  // ====================================================
  // DEĞER GEÇMİŞİ
  // ====================================================

  if (command === "değergeçmiş") {
    const player = message.mentions.members.first() || message.member;

    const logs = data.valueLogs
      .filter(x => x.user === player.id)
      .slice(-10);

    if (!logs.length) {
      return message.reply("❌ Değer geçmişi bulunamadı.");
    }

    return message.reply({
      embeds: [
        embed(
          `💎 ${player.user.username} Değer Geçmişi`,
          logs.map(x =>
            `${x.type === "increase" ? "📈" : "📉"} ${money(x.oldValue)} → ${money(x.newValue)}`
          ).join("\n")
        )
      ]
    });
  }

  // ====================================================
  // ANTRENMAN
  // ====================================================

  if (command === "ant" || command === "antrenman") {
    const user = ensureUser(message.author.id);

    user.training++;

    if (user.training >= 10) {
      user.training = 1;
      user.value += 3000000;

      data.valueLogs.push({
        user: message.author.id,
        type: "training",
        amount: 3000000,
        newValue: user.value,
        date: Date.now()
      });

      save();

      return message.reply({
        embeds: [
          embed(
            "🏋️ ANTRENMAN TAMAMLANDI",
            `**10/10** tamamlandı!\n\n💎 Değer artışı: **+3M€**\n💰 Yeni değer: **${money(user.value)}**\n\n📊 Yeni antrenman: **1/10**`
          )
        ]
      });
    }

    save();

    return message.reply(
      `🏋️ Antrenman ilerlemesi: **${user.training}/10**`
    );
  }

  // ====================================================
  // PENALTI
  // ====================================================

  if (command === "pen" || command === "penaltı") {
    const user = ensureUser(message.author.id);

    user.penalties.total++;

    const goal = Math.random() < 0.65;

    if (goal) {
      user.penalties.goals++;
      user.goals++;
      user.value += 2000000;

      save();

      return message.reply({
        embeds: [
          embed(
            "⚽ PENALTI",
            `🥅 **GOOOL!**\n\n💎 Değer artışı: **+2M€**\n💰 Yeni değer: **${money(user.value)}**`
          )
        ]
      });
    }

    user.penalties.misses++;

    save();

    return message.reply({
      embeds: [
        embed(
          "🧤 PENALTI",
          "❌ Kaleci kurtardı!\n\nDeğer artışı kazanamadın."
        )
      ]
    });
  }

  // ====================================================
  // PROFİL
  // ====================================================

  if (command === "profil") {
    const player = message.mentions.members.first() || message.member;
    const user = ensureUser(player.id);

    return message.reply({
      embeds: [
        embed(
          `👤 ${player.user.username} PROFİL`,
          `🏟️ Takım: **${user.team || "Takımsız"}**\n💎 Değer: **${money(user.value)}**\n💰 Bütçe: **${money(user.budget)}**\n⚽ Goller: **${user.goals}**\n🎯 Asistler: **${user.assists}**\n🎯 Penaltılar: **${user.penalties.goals}/${user.penalties.total}**\n🏋️ Antrenman: **${user.training}/10**\n🟨 Sarı Kart: **${user.yellow}**\n🟥 Kırmızı Kart: **${user.red}**`
        )
      ]
    });
  }

  // ====================================================
  // BÜTÇE
  // ====================================================

  if (command === "bütçe") {
    const user = ensureUser(message.author.id);

    return message.reply(
      `💰 Bütçen: **${money(user.budget)}**`
    );
  }

  // ====================================================
  // BÜTÇE VER
  // ====================================================

  if (command === "bütçever") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Yetkin yok.");
    }

    const player = message.mentions.members.first();
    const amount = moneyToNumber(args[1]);

    if (!player || amount <= 0) {
      return message.reply("❌ Kullanım: `.bütçever @oyuncu 10M`");
    }

    const user = ensureUser(player.id);
    user.budget += amount;

    data.budgetLogs.push({
      type: "give",
      user: player.id,
      amount,
      by: message.author.id,
      date: Date.now()
    });

    save();

    return message.reply(
      `✅ ${player} hesabına **${money(amount)}** verildi.`
    );
  }

  // ====================================================
  // BÜTÇE AL
  // ====================================================

  if (command === "bütçeal") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Yetkin yok.");
    }

    const player = message.mentions.members.first();
    const amount = moneyToNumber(args[1]);

    if (!player || amount <= 0) {
      return message.reply("❌ Kullanım: `.bütçeal @oyuncu 10M`");
    }

    const user = ensureUser(player.id);

    user.budget = Math.max(
      0,
      user.budget - amount
    );

    save();

    return message.reply(
      `✅ ${player} hesabından **${money(amount)}** alındı.`
    );
  }

  // ====================================================
  // GÖNDER
  // ====================================================

  if (command === "gönder") {
    const player = message.mentions.members.first();
    const amount = moneyToNumber(args[1]);

    if (!player || amount <= 0) {
      return message.reply("❌ Kullanım: `.gönder @oyuncu 5M`");
    }

    const sender = ensureUser(message.author.id);
    const receiver = ensureUser(player.id);

    if (sender.budget < amount) {
      return message.reply("❌ Yeterli bütçen yok.");
    }

    sender.budget -= amount;
    receiver.budget += amount;

    save();

    return message.reply(
      `💸 **${money(amount)}** ${player} kullanıcısına gönderildi.`
    );
  }

  // ====================================================
  // TAKIM BÜTÇESİ
  // ====================================================

  if (command === "takımbütçesi") {
    const team = Object.values(data.teams).find(
      t => t.td === message.author.id
    );

    if (!team) {
      return message.reply("❌ Takımın bulunamadı.");
    }

    return message.reply(
      `🏟️ **${team.name}** takım bütçesi: **${money(team.budget)}**`
    );
  }

  // ====================================================
  // BÜTÇELER
  // ====================================================

  if (command === "bütçeler") {
    const teams = Object.values(data.teams);

    if (!teams.length) {
      return message.reply("❌ Henüz takım kurulmamış.");
    }

    return message.reply({
      embeds: [
        embed(
          "💰 TAKIM BÜTÇELERİ",
          teams.map(
            t => `🏟️ **${t.name}** — ${money(t.budget)}`
          ).join("\n")
        )
      ]
    });
  }

  // ====================================================
  // OYUNCU AL
  // ====================================================

  if (command === "oyuncual") {
    const player = message.mentions.members.first();

    if (!player) {
      return message.reply("❌ Oyuncu etiketle.");
    }

    const team = Object.values(data.teams).find(
      t => t.td === message.author.id
    );

    if (!team) {
      return message.reply("❌ Bir takımın bulunmuyor.");
    }

    if (player.id === team.td) {
      return message.reply("❌ Takım sahibi transfer edilemez.");
    }

    const user = ensureUser(player.id);

    const modal = new ModalBuilder()
      .setCustomId(`contract_${player.id}_${team.name}`)
      .setTitle("Oyuncu Sözleşmesi");

    const salary = new TextInputBuilder()
      .setCustomId("salary")
      .setLabel("Maaş")
      .setPlaceholder("Örn: 2M")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const fee = new TextInputBuilder()
      .setCustomId("fee")
      .setLabel("Bonservis")
      .setPlaceholder("Örn: 10M")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const duration = new TextInputBuilder()
      .setCustomId("duration")
      .setLabel("Sözleşme süresi")
      .setPlaceholder("Örn: 30 gün")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const extra = new TextInputBuilder()
      .setCustomId("extra")
      .setLabel("Ek şartlar")
      .setPlaceholder("Ek şart yoksa Yok yaz.")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(salary),
      new ActionRowBuilder().addComponents(fee),
      new ActionRowBuilder().addComponents(duration),
      new ActionRowBuilder().addComponents(extra)
    );

    await message.reply({
      content: "📜 Sözleşme bilgilerini gir.",
      ephemeral: true
    });

    return message.channel.send({
      content: "👇 Sözleşme formunu açmak için butona bas.",
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`open_contract_${player.id}_${team.name}`)
            .setLabel("Sözleşme Formunu Aç")
            .setEmoji("📜")
            .setStyle(ButtonStyle.Primary)
        )
      ]
    });
  }

  // ====================================================
  // ŞİRKETLER
  // ====================================================

  if (command === "şirketler") {
    const list = COMPANIES
      .filter(c => !Object.values(data.companies).some(x => x.name === c.name))
      .map(
        c => `🏢 **${c.name}** — ${money(c.income)} gelir`
      );

    return message.reply({
      embeds: [
        embed(
          "🏢 ŞİRKETLER",
          list.length ? list.join("\n") : "Şirket kalmadı."
        )
      ]
    });
  }

  if (command === "şirketseç") {
    const name = args.join(" ");

    const company = COMPANIES.find(
      c => c.name.toLowerCase() === name.toLowerCase()
    );

    if (!company) {
      return message.reply("❌ Şirket bulunamadı.");
    }

    const team = Object.values(data.teams).find(
      t => t.td === message.author.id
    );

    if (!team) {
      return message.reply("❌ Takımın bulunamadı.");
    }

    if (Object.values(data.companies).some(c => c.name === company.name)) {
      return message.reply("❌ Bu şirket zaten seçilmiş.");
    }

    data.companies[team.name] = {
      name: company.name,
      income: company.income,
      started: Date.now()
    };

    save();

    return message.reply(
      `✅ **${company.name}** şirketi takımına seçildi.`
    );
  }

  // ====================================================
  // SPONSORLAR
  // ====================================================

  if (command === "sponsorlar") {
    return message.reply({
      embeds: [
        embed(
          "🤝 SPONSORLAR",
          SPONSORS.map(
            s => `🤝 **${s.name}** — ${money(s.income)}`
          ).join("\n")
        )
      ]
    });
  }

  if (command === "sponsorseç") {
    const name = args.join(" ");

    const sponsor = SPONSORS.find(
      s => s.name.toLowerCase() === name.toLowerCase()
    );

    if (!sponsor) {
      return message.reply("❌ Sponsor bulunamadı.");
    }

    const team = Object.values(data.teams).find(
      t => t.td === message.author.id
    );

    if (!team) {
      return message.reply("❌ Takımın bulunamadı.");
    }

    if (Object.values(data.sponsors).some(s => s.name === sponsor.name)) {
      return message.reply("❌ Bu sponsor zaten alınmış.");
    }

    data.sponsors[team.name] = {
      name: sponsor.name,
      income: sponsor.income,
      started: Date.now()
    };

    save();

    return message.reply(
      `✅ **${sponsor.name}** sponsor olarak seçildi.`
    );
  }

  // ====================================================
  // LİG / PUAN
  // ====================================================

  if (
    command === "lig" ||
    command === "puan" ||
    command === "fikstür"
  ) {
    const standings = getStandings();

    if (!standings.length) {
      return message.reply("❌ Henüz ligde takım yok.");
    }

    const text = standings.map((t, i) => {
      const o = t.played || 0;
      const g = t.wins || 0;
      const b = t.draws || 0;
      const m = t.losses || 0;
      const ag = t.gf || 0;
      const yg = t.ga || 0;
      const av = ag - yg;
      const p = t.points || 0;

      return `**${i + 1}. ${t.name}** | ${o} | ${g} | ${b} | ${m} | ${ag} | ${yg} | ${av} | **${p}**`;
    });

    return message.reply({
      embeds: [
        embed(
          "📊 UNITED LEAGUE PUAN DURUMU",
          "Sıra | Takım | O | G | B | M | AG | YG | AV | P\n\n" +
          text.join("\n")
        )
      ]
    });
  }

  // ====================================================
  // MAÇ
  // ====================================================

  if (command === "maç") {
    if (!isAdmin(message.member) && !hasRole(message.member, ROLES.YONETICI)) {
      return message.reply("❌ Maç yetkilisi değilsin.");
    }

    const mentions = [...message.mentions.users.values()];

    if (mentions.length < 2) {
      return message.reply(
        "❌ İki takım yöneticisini etiketle veya takım sistemine göre maç başlat."
      );
    }

    const teams = [];

    for (const user of mentions.slice(0, 2)) {
      const team = Object.values(data.teams).find(
        t => t.td === user.id
      );

      if (team) teams.push(team);
    }

    if (teams.length !== 2) {
      return message.reply("❌ Takımlardan biri bulunamadı.");
    }

    const home = teams[0];
    const away = teams[1];

    let homeScore = 0;
    let awayScore = 0;

    const events = [];

    const matchMessage = await message.channel.send({
      embeds: [
        embed(
          "⚽ UNITED LEAGUE MAÇI",
          `🏟️ **${home.name}** 0 - 0 **${away.name}**\n\n⏱️ Maç başlıyor...`
        )
      ]
    });

    const minutes = [7, 14, 21, 28, 36, 43, 51, 59, 67, 74, 82, 89];

    for (const minute of minutes) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const chance = Math.random();

      if (chance < 0.15) {
        homeScore++;

        const scorer =
          home.squad?.length
            ? `<@${home.squad[Math.floor(Math.random() * home.squad.length)}]>`
            : "Oyuncu";

        events.push(
          `⚽ **${minute}'** ${scorer} — **GOL!** ${home.name}`
        );
      } else if (chance > 0.85) {
        awayScore++;

        const scorer =
          away.squad?.length
            ? `<@${away.squad[Math.floor(Math.random() * away.squad.length)}]>`
            : "Oyuncu";

        events.push(
          `⚽ **${minute}'** ${scorer} — **GOL!** ${away.name}`
        );
      } else if (chance < 0.28) {
        events.push(
          `🟨 **${minute}'** Sert müdahale, hakem sarı kart gösterdi.`
        );
      } else if (chance > 0.72) {
        events.push(
          `🔄 **${minute}'** Teknik direktör oyuncu değişikliği yaptı.`
        );
      }

      await matchMessage.edit({
        embeds: [
          embed(
            `⚽ ${home.name} vs ${away.name}`,
            `**${home.name} ${homeScore} - ${awayScore} ${away.name}**\n\n` +
            events.slice(-6).join("\n")
          )
        ]
      });
    }

    if (!home.played) home.played = 0;
    if (!away.played) away.played = 0;

    if (!home.wins) home.wins = 0;
    if (!home.draws) home.draws = 0;
    if (!home.losses) home.losses = 0;
    if (!home.points) home.points = 0;
    if (!home.gf) home.gf = 0;
    if (!home.ga) home.ga = 0;

    if (!away.wins) away.wins = 0;
    if (!away.draws) away.draws = 0;
    if (!away.losses) away.losses = 0;
    if (!away.points) away.points = 0;
    if (!away.gf) away.gf = 0;
    if (!away.ga) away.ga = 0;

    home.played++;
    away.played++;

    home.gf += homeScore;
    home.ga += awayScore;

    away.gf += awayScore;
    away.ga += homeScore;

    if (homeScore > awayScore) {
      home.wins++;
      home.points += 3;
      away.losses++;
    } else if (awayScore > homeScore) {
      away.wins++;
      away.points += 3;
      home.losses++;
    } else {
      home.draws++;
      away.draws++;
      home.points++;
      away.points++;
    }

    const result = {
      home: home.name,
      away: away.name,
      homeScore,
      awayScore,
      events,
      date: Date.now()
    };

    data.matches.push(result);

    save();

    await matchMessage.edit({
      embeds: [
        embed(
          "🏁 MAÇ SONA ERDİ",
          `🏟️ **${home.name} ${homeScore} - ${awayScore} ${away.name}**\n\n` +
          events.join("\n") +
          `\n\n📊 Maç tamamlandı.`
        )
      ]
    });

    await logTo(
      message.guild,
      "transfer",
      `⚽ Maç sonucu: **${home.name} ${homeScore} - ${awayScore} ${away.name}**`
    );

    return;
  }

  // ====================================================
  // MAÇ GEÇMİŞİ
  // ====================================================

  if (command === "maçlar" || command === "maçgeçmişi") {
    const matches = data.matches.slice(-10);

    if (!matches.length) {
      return message.reply("❌ Maç geçmişi boş.");
    }

    return message.reply({
      embeds: [
        embed(
          "⚽ MAÇ GEÇMİŞİ",
          matches.map(
            m => `**${m.home} ${m.homeScore} - ${m.awayScore} ${m.away}**`
          ).join("\n")
        )
      ]
    });
  }

  // ====================================================
  // GOL KRALLIĞI
  // ====================================================

  if (command === "golkrallığı") {
    const users = Object.entries(data.users)
      .sort((a, b) => b[1].goals - a[1].goals)
      .slice(0, 10);

    return message.reply({
      embeds: [
        embed(
          "⚽ GOL KRALLIĞI",
          users.length
            ? users.map(
              (x, i) => `${i + 1}. <@${x[0]}> — **${x[1].goals} gol**`
            ).join("\n")
            : "Veri yok."
        )
      ]
    });
  }

  // ====================================================
  // ASİST KRALLIĞI
  // ====================================================

  if (command === "asistkrallığı") {
    const users = Object.entries(data.users)
      .sort((a, b) => b[1].assists - a[1].assists)
      .slice(0, 10);

    return message.reply({
      embeds: [
        embed(
          "🎯 ASİST KRALLIĞI",
          users.length
            ? users.map(
              (x, i) => `${i + 1}. <@${x[0]}> — **${x[1].assists} asist**`
            ).join("\n")
            : "Veri yok."
        )
      ]
    });
  }

  // ====================================================
  // ÇEKİLİŞ
  // ====================================================

  if (command === "çekiliş") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Çekiliş yetkilisi değilsin.");
    }

    const prize = args[0];
    const durationText = args[1];

    const duration = parseDuration(durationText);

    if (!prize || !duration) {
      return message.reply(
        "❌ Kullanım: `.çekiliş 30M€ 1h`"
      );
    }

    const giveaway = {
      id: Date.now().toString(),
      prize,
      end: Date.now() + duration,
      users: [],
      channel: message.channel.id,
      message: null
    };

    const giveawayMessage = await message.channel.send({
      embeds: [
        embed(
          "🎁 ÇEKİLİŞ",
          `🎁 Ödül: **${prize}**\n⏰ Süre: **${durationText}**\n\nKatılmak için aşağıdaki butona bas!`
        )
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`giveaway_${giveaway.id}`)
            .setLabel("Katıl")
            .setEmoji("🎉")
            .setStyle(ButtonStyle.Success)
        )
      ]
    });

    giveaway.message = giveawayMessage.id;

    data.giveaways.push(giveaway);
    save();

    setTimeout(async () => {
      const index = data.giveaways.findIndex(
        x => x.id === giveaway.id
      );

      if (index === -1) return;

      const current = data.giveaways[index];

      if (!current.users.length) {
        await message.channel.send("❌ Çekilişe kimse katılmadı.");
        data.giveaways.splice(index, 1);
        save();
        return;
      }

      const winner =
        current.users[
          Math.floor(Math.random() * current.users.length)
        ];

      await message.channel.send({
        embeds: [
          embed(
            "🎉 ÇEKİLİŞ SONUCU",
            `🎁 Ödül: **${current.prize}**\n\n🏆 Kazanan: <@${winner}>`
          )
        ]
      });

      data.giveaways.splice(index, 1);
      save();
    }, duration);

    return;
  }

  // ====================================================
  // TWEET
  // ====================================================

  if (command === "tweet") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Medya yetkilisi değilsin.");
    }

    const text = args.join(" ");

    if (!text) {
      return message.reply("❌ Tweet mesajı yaz.");
    }

    return message.channel.send({
      embeds: [
        new EmbedBuilder()
          .setAuthor({
            name: "United League Media"
          })
          .setDescription(`🐦 ${text}`)
          .setFooter({
            text: "United League • Sosyal Medya"
          })
          .setTimestamp()
      ]
    });
  }

  // ====================================================
  // HABER
  // ====================================================

  if (command === "haber") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Medya yetkilisi değilsin.");
    }

    const text = args.join(" ");

    if (!text) {
      return message.reply("❌ Haber yaz.");
    }

    return message.channel.send({
      embeds: [
        embed(
          "📰 UNITED LEAGUE HABER",
          text
        )
      ]
    });
  }

  // ====================================================
  // TRANSFER DUYURU
  // ====================================================

  if (command === "transferduyuru") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Medya yetkilisi değilsin.");
    }

    const text = args.join(" ");

    return message.channel.send({
      embeds: [
        embed(
          "🚨 TRANSFER DUYURUSU",
          text
        )
      ]
    });
  }

  // ====================================================
  // DUYURU
  // ====================================================

  if (command === "duyuru") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Yetkin yok.");
    }

    const text = args.join(" ");

    return message.channel.send({
      embeds: [
        embed(
          "📢 DUYURU",
          text
        )
      ]
    });
  }

  // ====================================================
  // EMBED
  // ====================================================

  if (command === "embed") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Yetkin yok.");
    }

    const text = args.join(" ");
    const split = text.split("|");

    const title = split[0] || "United League";
    const description = split.slice(1).join("|") || " ";

    return message.channel.send({
      embeds: [
        embed(title, description)
      ]
    });
  }

  // ====================================================
  // SPOILER
  // ====================================================

  if (command === "spoiler") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Yetkin yok.");
    }

    return message.channel.send(
      `||${args.join(" ")}||`
    );
  }

  // ====================================================
  // SİL
  // ====================================================

  if (command === "sil") {
    if (!isModerator(message.member)) {
      return message.reply("❌ Moderasyon yetkin yok.");
    }

    let amount = Number(args[0]);

    if (!amount || amount < 1) amount = 1;

    if (amount > 1000) {
      return message.reply("❌ En fazla 1000 mesaj silebilirsin.");
    }

    let remaining = amount;

    while (remaining > 0) {
      const batch = Math.min(remaining, 100);

      const messages = await message.channel.messages.fetch({
        limit: batch
      });

      if (!messages.size) break;

      await message.channel.bulkDelete(messages, true);

      remaining -= messages.size;

      if (messages.size < batch) break;
    }

    return message.channel.send(
      `🗑️ **${amount}** mesaja kadar silme işlemi tamamlandı.`
    ).then(m => {
      setTimeout(() => m.delete().catch(() => {}), 3000);
    });
  }

  // ====================================================
  // KICK
  // ====================================================

  if (command === "kick") {
    if (!isModerator(message.member)) {
      return message.reply("❌ Moderasyon yetkin yok.");
    }

    const member = message.mentions.members.first();

    if (!member) {
      return message.reply("❌ Kullanıcı etiketle.");
    }

    if (!member.kickable) {
      return message.reply("❌ Bu kullanıcıyı atamıyorum.");
    }

    await member.kick(args.slice(1).join(" ") || "Sebep belirtilmedi.");

    return message.reply(
      `👢 ${member.user.tag} sunucudan atıldı.`
    );
  }

  // ====================================================
  // BAN
  // ====================================================

  if (command === "ban") {
    if (!isModerator(message.member)) {
      return message.reply("❌ Moderasyon yetkin yok.");
    }

    const member = message.mentions.members.first();

    if (!member) {
      return message.reply("❌ Kullanıcı etiketle.");
    }

    if (!member.bannable) {
      return message.reply("❌ Bu kullanıcıyı yasaklayamıyorum.");
    }

    await member.ban({
      reason: args.slice(1).join(" ") || "Sebep belirtilmedi."
    });

    return message.reply(
      `🔨 ${member.user.tag} yasaklandı.`
    );
  }

  // ====================================================
  // MUTE
  // ====================================================

  if (command === "mute") {
    if (!isModerator(message.member)) {
      return message.reply("❌ Moderasyon yetkin yok.");
    }

    const member = message.mentions.members.first();

    if (!member) {
      return message.reply("❌ Kullanıcı etiketle.");
    }

    let muteRole = message.guild.roles.cache.find(
      r => r.name.toLowerCase() === "mute"
    );

    if (!muteRole) {
      muteRole = await message.guild.roles.create({
        name: "Mute",
        reason: "United League mute sistemi"
      });
    }

    await member.roles.add(muteRole);

    return message.reply(
      `🔇 ${member} susturuldu.`
    );
  }

  // ====================================================
  // UNMUTE
  // ====================================================

  if (command === "unmute") {
    if (!isModerator(message.member)) {
      return message.reply("❌ Moderasyon yetkin yok.");
    }

    const member = message.mentions.members.first();

    const muteRole = message.guild.roles.cache.find(
      r => r.name.toLowerCase() === "mute"
    );

    if (!member || !muteRole) {
      return message.reply("❌ Kullanıcı veya mute rolü bulunamadı.");
    }

    await member.roles.remove(muteRole);

    return message.reply(
      `🔊 ${member} susturması kaldırıldı.`
    );
  }

  // ====================================================
  // UYAR
  // ====================================================

  if (command === "uyar") {
    if (!isModerator(message.member)) {
      return message.reply("❌ Moderasyon yetkin yok.");
    }

    const member = message.mentions.members.first();

    if (!member) {
      return message.reply("❌ Kullanıcı etiketle.");
    }

    const user = ensureUser(member.id);

    user.warnings.push({
      reason: args.slice(1).join(" ") || "Sebep belirtilmedi.",
      moderator: message.author.id,
      date: Date.now()
    });

    save();

    return message.reply(
      `⚠️ ${member} uyarıldı.`
    );
  }

  // ====================================================
  // SİCİL
  // ====================================================

  if (command === "sicil") {
    if (!isModerator(message.member)) {
      return message.reply("❌ Moderasyon yetkin yok.");
    }

    const member = message.mentions.members.first();

    if (!member) {
      return message.reply("❌ Kullanıcı etiketle.");
    }

    const user = ensureUser(member.id);

    return message.reply({
      embeds: [
        embed(
          `📋 ${member.user.username} Sicili`,
          user.warnings.length
            ? user.warnings.map(
              (w, i) => `${i + 1}. ${w.reason}`
            ).join("\n")
            : "Temiz sicil."
        )
      ]
    });
  }

  // ====================================================
  // KİLİT
  // ====================================================

  if (command === "kilit") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Yetkin yok.");
    }

    await message.channel.permissionOverwrites.edit(
      message.guild.roles.everyone,
      {
        SendMessages: false
      }
    );

    return message.reply("🔒 Kanal kilitlendi.");
  }

  // ====================================================
  // AÇ
  // ====================================================

  if (command === "aç") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Yetkin yok.");
    }

    await message.channel.permissionOverwrites.edit(
      message.guild.roles.everyone,
      {
        SendMessages: null
      }
    );

    return message.reply("🔓 Kanal açıldı.");
  }

  // ====================================================
  // DM
  // ====================================================

  if (command === "dm") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Yetkin yok.");
    }

    const member = message.mentions.members.first();

    if (!member) {
      return message.reply("❌ Kullanıcı etiketle.");
    }

    const text = args.slice(1).join(" ");

    if (!text) {
      return message.reply("❌ Mesaj yaz.");
    }

    await member.send(text).catch(() => {});

    return message.reply("📩 DM gönderildi.");
  }

  // ====================================================
  // DM ALL
  // ====================================================

  if (command === "dmall") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Yetkin yok.");
    }

    const text = args.join(" ");

    if (!text) {
      return message.reply("❌ Mesaj yaz.");
    }

    await message.reply(
      "📨 DM gönderimi başlatıldı."
    );

    let sent = 0;

    for (const member of message.guild.members.cache.values()) {
      if (member.user.bot) continue;

      try {
        await member.send(text);
        sent++;
      } catch {}
    }

    return message.channel.send(
      `✅ DM gönderimi tamamlandı. **${sent}** kişiye gönderildi.`
    );
  }

  // ====================================================
  // YARDIM
  // ====================================================

  if (command === "yardım" || command === "help") {
    return message.reply({
      embeds: [
        embed(
          "📚 UNITED LEAGUE KOMUTLARI",
          `**👤 Kayıt**
\`.k @oyuncu İsim\`

**🏟️ Takım**
\`.takımkur\`
\`.kadro\`
\`.kadrom\`
\`.kadroekle @oyuncu\`
\`.kadroçıkar @oyuncu\`
\`.formasyon 4-2-1-3-2\`

**💎 Değer**
\`.dver @oyuncu 5M\`
\`.dsil @oyuncu 5M\`
\`.değer @oyuncu\`
\`.değergeçmiş @oyuncu\`

**🏋️ Oyuncu**
\`.ant\`
\`.antrenman\`
\`.pen\`
\`.penaltı\`
\`.profil\`

**⚽ Lig**
\`.maç\`
\`.maçlar\`
\`.maçgeçmişi\`
\`.lig\`
\`.puan\`
\`.fikstür\`
\`.golkrallığı\`
\`.asistkrallığı\`

**💰 Ekonomi**
\`.bütçe\`
\`.bütçever\`
\`.bütçeal\`
\`.gönder\`
\`.takımbütçesi\`
\`.bütçeler\`

**🤝 Sponsor / Şirket**
\`.sponsorlar\`
\`.sponsorseç\`
\`.şirketler\`
\`.şirketseç\`

**🎁 Etkinlik**
\`.çekiliş 30M€ 1h\`

**📰 Medya**
\`.tweet mesaj\`
\`.haber mesaj\`
\`.transferduyuru mesaj\`
\`.duyuru mesaj\`

**🛡️ Moderasyon**
\`.sil 100\`
\`.kick @oyuncu\`
\`.ban @oyuncu\`
\`.mute @oyuncu\`
\`.unmute @oyuncu\`
\`.uyar @oyuncu sebep\`
\`.sicil @oyuncu\`
\`.kilit\`
\`.aç\`

**📩 Diğer**
\`.dm @oyuncu mesaj\`
\`.dmall mesaj\`
\`.embed Başlık | Açıklama\`
\`.spoiler mesaj\``
        )
      ]
    });
  }
});

// ======================================================
// BUTONLAR / MENÜLER / MODALLAR
// ======================================================

client.on("interactionCreate", async interaction => {
  try {
    // ====================================================
    // KAYIT BUTONLARI
    // ====================================================

    if (interaction.isButton()) {

      if (
        interaction.customId === "register_player" ||
        interaction.customId.startsWith("reg_player_")
      ) {
        const member = interaction.member;

        if (interaction.customId.startsWith("reg_player_")) {
          const parts = interaction.customId.split("_");
          const userId = parts[2];

          if (userId !== member.id) {
            return interaction.reply({
              content: "❌ Bu kayıt butonu senin için değil.",
              ephemeral: true
            });
          }
        }

        const guildMember = interaction.guild.members.cache.get(
          member.id
        );

        if (ROLES.KAYITSIZ !== "KAYITSIZ_ROLE_ID") {
          await guildMember.roles.remove(ROLES.KAYITSIZ).catch(() => {});
        }

        await guildMember.roles.add(ROLES.OYUNCU).catch(() => {});

        const user = ensureUser(member.id);
        user.team = null;

        data.registrations.push({
          user: member.id,
          type: "Futbolcu",
          date: Date.now()
        });

        save();

        const chat = interaction.guild.channels.cache.find(
          c => c.name === "sohbet"
        );

        if (chat) {
          await chat.send({
            embeds: [
              embed(
                "✅ KAYIT TAMAMLANDI",
                `⚽ ${member} başarıyla **Futbolcu** olarak kayıt oldu!`
              )
            ]
          });
        }

        return interaction.reply({
          content: "✅ Futbolcu kaydın tamamlandı.",
          ephemeral: true
        });
      }

      // ==================================================
      // TD KAYIT
      // ==================================================

      if (
        interaction.customId === "register_td" ||
        interaction.customId.startsWith("reg_td_")
      ) {
        const member = interaction.member;

        if (interaction.customId.startsWith("reg_td_")) {
          const parts = interaction.customId.split("_");
          const userId = parts[2];

          if (userId !== member.id) {
            return interaction.reply({
              content: "❌ Bu kayıt butonu senin için değil.",
              ephemeral: true
            });
          }
        }

        const guildMember = interaction.guild.members.cache.get(
          member.id
        );

        if (ROLES.KAYITSIZ !== "KAYITSIZ_ROLE_ID") {
          await guildMember.roles.remove(ROLES.KAYITSIZ).catch(() => {});
        }

        await guildMember.roles.add(ROLES.TD).catch(() => {});

        const user = ensureUser(member.id);

        data.registrations.push({
          user: member.id,
          type: "Teknik Direktör",
          date: Date.now()
        });

        save();

        const chat = interaction.guild.channels.cache.find(
          c => c.name === "sohbet"
        );

        if (chat) {
          await chat.send({
            embeds: [
              embed(
                "✅ KAYIT TAMAMLANDI",
                `👔 ${member} başarıyla **Teknik Direktör** olarak kayıt oldu!`
              )
            ]
          });
        }

        return interaction.reply({
          content: "✅ Teknik Direktör kaydın tamamlandı.",
          ephemeral: true
        });
      }

      // ==================================================
      // TAKIM OLUŞTUR
      // ==================================================

      if (interaction.customId.startsWith("open_contract_")) {
        const parts = interaction.customId.split("_");
        const playerId = parts[2];
        const teamName = parts.slice(3).join("_");

        const modal = new ModalBuilder()
          .setCustomId(`contract_${playerId}_${teamName}`)
          .setTitle("Oyuncu Sözleşmesi");

        const salary = new TextInputBuilder()
          .setCustomId("salary")
          .setLabel("Maaş")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const fee = new TextInputBuilder()
          .setCustomId("fee")
          .setLabel("Bonservis")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const duration = new TextInputBuilder()
          .setCustomId("duration")
          .setLabel("Süre")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const extra = new TextInputBuilder()
          .setCustomId("extra")
          .setLabel("Ek Şart")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false);

        modal.addComponents(
          new ActionRowBuilder().addComponents(salary),
          new ActionRowBuilder().addComponents(fee),
          new ActionRowBuilder().addComponents(duration),
          new ActionRowBuilder().addComponents(extra)
        );

        return interaction.showModal(modal);
      }

      // ==================================================
      // ÇEKİLİŞ
      // ==================================================

      if (interaction.customId.startsWith("giveaway_")) {
        const id = interaction.customId.replace("giveaway_", "");

        const giveaway = data.giveaways.find(
          g => g.id === id
        );

        if (!giveaway) {
          return interaction.reply({
            content: "❌ Bu çekiliş sona ermiş.",
            ephemeral: true
          });
        }

        if (!giveaway.users.includes(interaction.user.id)) {
          giveaway.users.push(interaction.user.id);
          save();

          return interaction.reply({
            content: "🎉 Çekilişe katıldın!",
            ephemeral: true
          });
        }

        return interaction.reply({
          content: "❌ Zaten çekilişe katıldın.",
          ephemeral: true
        });
      }
    }

    // ====================================================
    // TAKIM SELECT MENU
    // ====================================================

    if (interaction.isStringSelectMenu()) {
      if (interaction.customId.startsWith("team_create_")) {
        const ownerId = interaction.customId.replace(
          "team_create_",
          ""
        );

        if (interaction.user.id !== ownerId) {
          return interaction.reply({
            content: "❌ Bu menü sana ait değil.",
            ephemeral: true
          });
        }

        const teamName = interaction.values[0];

        if (data.usedTeams.includes(teamName)) {
          return interaction.reply({
            content: "❌ Bu takım daha önce seçildi.",
            ephemeral: true
          });
        }

        const role = await interaction.guild.roles.create({
          name: teamName,
          reason: "United League takım sistemi"
        });

        data.teams[teamName] = {
          name: teamName,
          td: interaction.user.id,
          role: role.id,
          budget: 100000000,
          squad: [],
          formation: "4-3-3",
          played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          gf: 0,
          ga: 0,
          points: 0,
          sponsor: null,
          company: null
        };

        data.usedTeams.push(teamName);

        await interaction.member.roles.add(role).catch(() => {});

        save();

        return interaction.update({
          embeds: [
            embed(
              "🏟️ TAKIM KURULDU",
              `✅ Takımın başarıyla kuruldu.\n\n🏟️ Takım: **${teamName}**\n👔 TD: ${interaction.user}\n💰 Başlangıç bütçesi: **100M€**\n📐 Formasyon: **4-3-3**`
            )
          ],
          components: []
        });
      }
    }

    // ====================================================
    // MODAL
    // ====================================================

    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith("contract_")) {
        const parts = interaction.customId.split("_");

        const playerId = parts[1];
        const teamName = parts.slice(2).join("_");

        const salary = moneyToNumber(
          interaction.fields.getTextInputValue("salary")
        );

        const fee = moneyToNumber(
          interaction.fields.getTextInputValue("fee")
        );

        const duration =
          interaction.fields.getTextInputValue("duration");

        const extra =
          interaction.fields.getTextInputValue("extra") || "Yok";

        const team = data.teams[teamName];

        if (!team) {
          return interaction.reply({
            content: "❌ Takım bulunamadı.",
            ephemeral: true
          });
        }

        if (team.td !== interaction.user.id) {
          return interaction.reply({
            content: "❌ Bu takımın Teknik Direktörü değilsin.",
            ephemeral: true
          });
        }

        if (team.budget < fee) {
          return interaction.reply({
            content: "❌ Takım bütçesi bu transfer iç
