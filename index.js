/* =========================================================
   UNITED LEAGUE • FUTBOL RP DISCORD BOT
   Discord.js v14
   Prefix: .
========================================================= */

const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActivityType,
} = require("discord.js");

const fs = require("fs");
const path = require("path");

/* =========================================================
   AYARLAR
========================================================= */

const TOKEN = process.env.TOKEN;
const PREFIX = ".";

if (!TOKEN) {
  console.error("❌ TOKEN değişkeni bulunamadı.");
  process.exit(1);
}

const ADMIN_ROLE_ID = "1544449436011339806";
const REGISTER_ROLE_ID = "1544452022764568656";
const VALUE_ROLE_ID = "1544451743746891806";

const ANNOUNCEMENT_CHANNEL_ID = "1544653653330108477";

const DATA_FILE = path.join(__dirname, "data.json");

/* =========================================================
   CLIENT
========================================================= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.User],
});

/* =========================================================
   DATABASE
========================================================= */

const defaultData = {
  players: {},
  teams: {},
  transfers: [],
  kap: {},
  matches: [],
  giveaways: {},
  companies: {},
  sponsors: {},
  ads: {},
  registrations: {},
  setup: {},
  users: {},
  countryRoles: {},
  season: {
    number: 1,
    startedAt: Date.now(),
  },
};

let db;

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      db = JSON.parse(JSON.stringify(defaultData));
      saveData();
      return;
    }

    db = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

    for (const key of Object.keys(defaultData)) {
      if (db[key] === undefined) {
        db[key] = JSON.parse(JSON.stringify(defaultData[key]));
      }
    }
  } catch (err) {
    console.error("data.json okunamadı:", err);
    db = JSON.parse(JSON.stringify(defaultData));
  }
}

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
  } catch (err) {
    console.error("Database kayıt hatası:", err);
  }
}

loadData();

/* =========================================================
   DİL SİSTEMİ
========================================================= */

const LANGUAGES = [
  ["tr", "🇹🇷", "Türkçe", "Türkiye"],
  ["en", "🇬🇧", "English", "United Kingdom"],
  ["de", "🇩🇪", "Deutsch", "Deutschland"],
  ["fr", "🇫🇷", "Français", "France"],
  ["es", "🇪🇸", "Español", "España"],
  ["it", "🇮🇹", "Italiano", "Italia"],
  ["pt", "🇵🇹", "Português", "Portugal"],
  ["br", "🇧🇷", "Português", "Brasil"],
  ["ru", "🇷🇺", "Русский", "Россия"],
  ["uk", "🇺🇦", "Українська", "Україна"],
  ["nl", "🇳🇱", "Nederlands", "Nederland"],
  ["pl", "🇵🇱", "Polski", "Polska"],
  ["gr", "🇬🇷", "Ελληνικά", "Ελλάδα"],
  ["se", "🇸🇪", "Svenska", "Sverige"],
  ["no", "🇳🇴", "Norsk", "Norge"],
  ["dk", "🇩🇰", "Dansk", "Danmark"],
  ["fi", "🇫🇮", "Suomi", "Suomi"],
  ["cz", "🇨🇿", "Čeština", "Česko"],
  ["hu", "🇭🇺", "Magyar", "Magyarország"],
  ["ro", "🇷🇴", "Română", "România"],
  ["bg", "🇧🇬", "Български", "България"],
  ["hr", "🇭🇷", "Hrvatski", "Hrvatska"],
  ["rs", "🇷🇸", "Srpski", "Srbija"],
  ["sk", "🇸🇰", "Slovenčina", "Slovensko"],
  ["si", "🇸🇮", "Slovenščina", "Slovenija"],
  ["is", "🇮🇸", "Íslenska", "Ísland"],
  ["ee", "🇪🇪", "Eesti", "Eesti"],
  ["lv", "🇱🇻", "Latviešu", "Latvija"],
  ["lt", "🇱🇹", "Lietuvių", "Lietuva"],
  ["ar", "🇸🇦", "العربية", "Saudi Arabia"],
  ["fa", "🇮🇷", "فارسی", "Iran"],
  ["he", "🇮🇱", "עברית", "Israel"],
  ["zh", "🇨🇳", "中文", "China"],
  ["ja", "🇯🇵", "日本語", "Japan"],
  ["ko", "🇰🇷", "한국어", "South Korea"],
  ["hi", "🇮🇳", "हिन्दी", "India"],
  ["ur", "🇵🇰", "اردو", "Pakistan"],
  ["bn", "🇧🇩", "বাংলা", "Bangladesh"],
  ["id", "🇮🇩", "Bahasa Indonesia", "Indonesia"],
  ["ms", "🇲🇾", "Bahasa Melayu", "Malaysia"],
  ["fil", "🇵🇭", "Filipino", "Philippines"],
  ["vi", "🇻🇳", "Tiếng Việt", "Vietnam"],
  ["th", "🇹🇭", "ไทย", "Thailand"],
];

const TEXT = {
  tr: {
    noPermission: "❌ Bu komutu kullanmak için yetkin yok.",
    success: "✅ İşlem başarıyla tamamlandı.",
    error: "❌ Bir hata oluştu.",
    language: "🌐 Dil Seçimi",
    languageSelected: "✅ Diliniz başarıyla değiştirildi.",
    registration: "📝 Kayıt",
    footballer: "Futbolcu",
    director: "Teknik Direktör",
    value: "Değer",
    budget: "Bütçe",
    team: "Takım",
    noTeam: "Takımsız",
    profile: "Profil",
    training: "Antrenman",
    penalty: "Penaltı",
  },

  en: {
    noPermission: "❌ You do not have permission to use this command.",
    success: "✅ The operation was completed successfully.",
    error: "❌ An error occurred.",
    language: "🌐 Language Selection",
    languageSelected: "✅ Your language has been changed successfully.",
    registration: "📝 Registration",
    footballer: "Footballer",
    director: "Technical Director",
    value: "Value",
    budget: "Budget",
    team: "Team",
    noTeam: "No Team",
    profile: "Profile",
    training: "Training",
    penalty: "Penalty",
  },

  de: {
    noPermission: "❌ Du hast keine Berechtigung für diesen Befehl.",
    success: "✅ Vorgang erfolgreich abgeschlossen.",
    error: "❌ Ein Fehler ist aufgetreten.",
    language: "🌐 Sprachauswahl",
    languageSelected: "✅ Deine Sprache wurde geändert.",
    registration: "📝 Registrierung",
    footballer: "Fußballer",
    director: "Technischer Direktor",
    value: "Wert",
    budget: "Budget",
    team: "Mannschaft",
    noTeam: "Keine Mannschaft",
    profile: "Profil",
    training: "Training",
    penalty: "Elfmeter",
  },

  fr: {
    noPermission: "❌ Vous n'avez pas la permission.",
    success: "✅ Opération réussie.",
    error: "❌ Une erreur est survenue.",
    language: "🌐 Sélection de la langue",
    languageSelected: "✅ Votre langue a été modifiée.",
    registration: "📝 Inscription",
    footballer: "Joueur",
    director: "Directeur technique",
    value: "Valeur",
    budget: "Budget",
    team: "Équipe",
    noTeam: "Aucune équipe",
    profile: "Profil",
    training: "Entraînement",
    penalty: "Penalty",
  },

  es: {
    noPermission: "❌ No tienes permiso para usar este comando.",
    success: "✅ Operación completada.",
    error: "❌ Ocurrió un error.",
    language: "🌐 Selección de idioma",
    languageSelected: "✅ Tu idioma ha sido cambiado.",
    registration: "📝 Registro",
    footballer: "Futbolista",
    director: "Director técnico",
    value: "Valor",
    budget: "Presupuesto",
    team: "Equipo",
    noTeam: "Sin equipo",
    profile: "Perfil",
    training: "Entrenamiento",
    penalty: "Penalti",
  },

  it: {
    noPermission: "❌ Non hai il permesso.",
    success: "✅ Operazione completata.",
    error: "❌ Si è verificato un errore.",
    language: "🌐 Selezione lingua",
    languageSelected: "✅ La tua lingua è stata cambiata.",
    registration: "📝 Registrazione",
    footballer: "Calciatore",
    director: "Direttore tecnico",
    value: "Valore",
    budget: "Budget",
    team: "Squadra",
    noTeam: "Senza squadra",
    profile: "Profilo",
    training: "Allenamento",
    penalty: "Rigore",
  },

  pt: {
    noPermission: "❌ Você não tem permissão.",
    success: "✅ Operação concluída.",
    error: "❌ Ocorreu um erro.",
    language: "🌐 Seleção de idioma",
    languageSelected: "✅ Seu idioma foi alterado.",
    registration: "📝 Registro",
    footballer: "Jogador",
    director: "Diretor técnico",
    value: "Valor",
    budget: "Orçamento",
    team: "Equipe",
    noTeam: "Sem equipe",
    profile: "Perfil",
    training: "Treinamento",
    penalty: "Pênalti",
  },

  ru: {
    noPermission: "❌ У вас нет разрешения.",
    success: "✅ Операция выполнена.",
    error: "❌ Произошла ошибка.",
    language: "🌐 Выбор языка",
    languageSelected: "✅ Язык изменён.",
    registration: "📝 Регистрация",
    footballer: "Футболист",
    director: "Технический директор",
    value: "Стоимость",
    budget: "Бюджет",
    team: "Команда",
    noTeam: "Без команды",
    profile: "Профиль",
    training: "Тренировка",
    penalty: "Пенальти",
  },

  ar: {
    noPermission: "❌ ليس لديك صلاحية.",
    success: "✅ تمت العملية بنجاح.",
    error: "❌ حدث خطأ.",
    language: "🌐 اختيار اللغة",
    languageSelected: "✅ تم تغيير لغتك.",
    registration: "📝 التسجيل",
    footballer: "لاعب كرة قدم",
    director: "مدير فني",
    value: "القيمة",
    budget: "الميزانية",
    team: "الفريق",
    noTeam: "بدون فريق",
    profile: "الملف الشخصي",
    training: "التدريب",
    penalty: "ركلة جزاء",
  },

  zh: {
    noPermission: "❌ 你没有权限使用此命令。",
    success: "✅ 操作成功。",
    error: "❌ 发生错误。",
    language: "🌐 语言选择",
    languageSelected: "✅ 语言已更改。",
    registration: "📝 注册",
    footballer: "足球运动员",
    director: "技术总监",
    value: "身价",
    budget: "预算",
    team: "球队",
    noTeam: "无球队",
    profile: "个人资料",
    training: "训练",
    penalty: "点球",
  },

  ja: {
    noPermission: "❌ このコマンドを使用する権限がありません。",
    success: "✅ 完了しました。",
    error: "❌ エラーが発生しました。",
    language: "🌐 言語選択",
    languageSelected: "✅ 言語を変更しました。",
    registration: "📝 登録",
    footballer: "サッカー選手",
    director: "テクニカルディレクター",
    value: "価値",
    budget: "予算",
    team: "チーム",
    noTeam: "チームなし",
    profile: "プロフィール",
    training: "トレーニング",
    penalty: "PK",
  },

  ko: {
    noPermission: "❌ 이 명령을 사용할 권한이 없습니다.",
    success: "✅ 작업이 완료되었습니다.",
    error: "❌ 오류가 발생했습니다.",
    language: "🌐 언어 선택",
    languageSelected: "✅ 언어가 변경되었습니다.",
    registration: "📝 등록",
    footballer: "축구 선수",
    director: "기술 감독",
    value: "가치",
    budget: "예산",
    team: "팀",
    noTeam: "팀 없음",
    profile: "프로필",
    training: "훈련",
    penalty: "페널티",
  },
};

function getLang(userId) {
  return db.users[userId]?.language || "tr";
}

function t(userId, key) {
  const lang = getLang(userId);
  return TEXT[lang]?.[key] || TEXT.tr[key] || key;
}

/* =========================================================
   ÜLKE ROLLERİ
========================================================= */

async function getOrCreateCountryRole(guild, langCode) {
  if (!db.countryRoles[guild.id]) {
    db.countryRoles[guild.id] = {};
  }

  if (db.countryRoles[guild.id][langCode]) {
    const oldRole = guild.roles.cache.get(
      db.countryRoles[guild.id][langCode]
    );

    if (oldRole) return oldRole;
  }

  const lang = LANGUAGES.find((x) => x[0] === langCode);

  if (!lang) return null;

  const role = await guild.roles.create({
    name: `${lang[1]} ${lang[3]}`,
    reason: "United League dil/ülke sistemi",
  });

  db.countryRoles[guild.id][langCode] = role.id;
  saveData();

  return role;
}

async function setLanguage(member, langCode) {
  const lang = LANGUAGES.find((x) => x[0] === langCode);
  if (!lang) return false;

  if (!db.users[member.id]) {
    db.users[member.id] = {};
  }

  db.users[member.id].language = langCode;

  for (const item of LANGUAGES) {
    const roleId = db.countryRoles[member.guild.id]?.[item[0]];

    if (roleId && member.roles.cache.has(roleId)) {
      await member.roles.remove(roleId).catch(() => {});
    }
  }

  const role = await getOrCreateCountryRole(member.guild, langCode);

  if (role) {
    await member.roles.add(role).catch(() => {});
  }

  saveData();
  return true;
}

/* =========================================================
   YARDIMCI
========================================================= */

function isAdmin(member) {
  return (
    member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    member.roles.cache.has(ADMIN_ROLE_ID)
  );
}

function isRegisterStaff(member) {
  return isAdmin(member) || member.roles.cache.has(REGISTER_ROLE_ID);
}

function isValueStaff(member) {
  return isAdmin(member) || member.roles.cache.has(VALUE_ROLE_ID);
}

function isDirector(member) {
  const role = member.guild.roles.cache.find(
    (r) =>
      r.name.toLowerCase() === "teknik direktör" ||
      r.name.toLowerCase() === "teknik direktor"
  );

  return (
    isAdmin(member) ||
    (role && member.roles.cache.has(role.id))
  );
}

function formatMoney(value) {
  value = Number(value) || 0;
  return `${value.toLocaleString("tr-TR")}€`;
}

function parseMoney(input) {
  if (!input) return NaN;

  let value = String(input)
    .toLowerCase()
    .replace(/€/g, "")
    .replace(/\s/g, "")
    .replace(/,/g, ".");

  if (value.endsWith("m")) {
    return parseFloat(value.slice(0, -1)) * 1000000;
  }

  if (value.endsWith("k")) {
    return parseFloat(value.slice(0, -1)) * 1000;
  }

  return Number(value);
}

function formatDuration(ms) {
  let seconds = Math.floor(ms / 1000);

  const days = Math.floor(seconds / 86400);
  seconds %= 86400;

  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;

  const minutes = Math.floor(seconds / 60);
  seconds %= 60;

  const parts = [];

  if (days) parts.push(`${days}g`);
  if (hours) parts.push(`${hours}s`);
  if (minutes) parts.push(`${minutes}dk`);
  if (seconds) parts.push(`${seconds}sn`);

  return parts.join(" ") || "0sn";
}

function getPlayer(id) {
  if (!db.players[id]) {
    db.players[id] = {
      value: 1000000,
      budget: 0,
      goals: 0,
      assists: 0,
      penaltyGoals: 0,
      trainings: 0,
      trainingProgress: 0,
      matches: 0,
      xp: 0,
      level: 1,
      teamId: null,
      achievements: [],
      registered: false,
      role: "Futbolcu",
    };
  }

  return db.players[id];
}

function addXP(id, amount) {
  const player = getPlayer(id);

  player.xp += amount;

  while (player.xp >= player.level * 100) {
    player.xp -= player.level * 100;
    player.level++;
  }
}

function addAchievement(id, achievement) {
  const player = getPlayer(id);

  if (!player.achievements.includes(achievement)) {
    player.achievements.push(achievement);
  }
}

function updateNickname(member) {
  const player = getPlayer(member.id);

  let name = member.nickname || member.user.username;

  const parts = name.split("|");

  if (parts.length >= 2) {
    parts[parts.length - 1] = ` ${formatMoney(player.value)}`;
    name = parts.join("|").trim();
  } else {
    name = `${name} | ${formatMoney(player.value)}`;
  }

  if (name.length > 32) {
    name = name.slice(0, 32);
  }

  member.setNickname(name).catch(() => {});
}

function getPlayerTeam(memberId) {
  const player = getPlayer(memberId);

  if (!player.teamId) return null;

  return db.teams[player.teamId] || null;
}

function findChannel(guild, names) {
  return guild.channels.cache.find((channel) =>
    names.includes(channel.name.toLowerCase())
  );
}

/* =========================================================
   ROLLER
========================================================= */

async function setupRoles(guild) {
  const roles = {};

  const roleNames = [
    "Kayıtsız",
    "Futbolcu",
    "Teknik Direktör",
    "Muted",
  ];

  for (const name of roleNames) {
    let role = guild.roles.cache.find(
      (r) => r.name.toLowerCase() === name.toLowerCase()
    );

    if (!role) {
      role = await guild.roles.create({
        name,
        reason: "United League sistem kurulumu",
      });
    }

    roles[name] = role;
  }

  return roles;
}

/* =========================================================
   SUNUCU KURULUM
========================================================= */

const SETUP_STRUCTURE = {
  "📁 UNITED LEAGUE": [
    ["📢・duyurular", "text"],
    ["📜・kurallar", "text"],
    ["🤖・bot-durum", "text"],
    ["💬・sohbet", "text"],
    ["📰・haberler", "text"],
    ["🐦・tweetler", "text"],
  ],

  "📁 KAYIT & DESTEK": [
    ["📝・kayıt", "text"],
    ["🎫・ticket-panel", "text"],
    ["📋・destek", "text"],
  ],

  "📁 FUTBOL RP": [
    ["⚽・maçlar", "text"],
    ["📋・kadro", "text"],
    ["💰・değerler", "text"],
    ["🏋️・antrenman", "text"],
    ["🥅・penaltı", "text"],
    ["🔄・transferler", "text"],
    ["📄・kap", "text"],
    ["🏆・lig", "text"],
  ],

  "📁 EKONOMİ": [
    ["💶・bütçeler", "text"],
    ["🤝・sponsorlar", "text"],
    ["🏢・şirketler", "text"],
    ["📢・reklam", "text"],
  ],

  "📁 ETKİNLİK": [
    ["🎁・çekiliş", "text"],
    ["🏅・başarımlar", "text"],
    ["🏆・sezon", "text"],
  ],

  "📁 YÖNETİM": [
    ["📋・bot-komutları", "text"],
    ["📊・istatistik", "text"],
    ["🔒・bot-log", "text"],
  ],
};

async function cleanPreviousSetup(guild) {
  const setup = db.setup[guild.id];

  if (!setup) return;

  if (setup.channels) {
    for (const id of setup.channels) {
      const channel = guild.channels.cache.get(id);

      if (channel) {
        await channel.delete("United League yeniden kurulum").catch(() => {});
      }
    }
  }

  if (setup.categories) {
    for (const id of setup.categories) {
      const category = guild.channels.cache.get(id);

      if (category) {
        await category.delete("United League yeniden kurulum").catch(() => {});
      }
    }
  }

  if (setup.roles) {
    for (const id of setup.roles) {
      const role = guild.roles.cache.get(id);

      if (
        role &&
        role.id !== ADMIN_ROLE_ID &&
        role.id !== REGISTER_ROLE_ID &&
        role.id !== VALUE_ROLE_ID
      ) {
        await role.delete("United League yeniden kurulum").catch(() => {});
      }
    }
  }

  db.setup[guild.id] = {
    channels: [],
    categories: [],
    roles: [],
    teamRoles: [],
  };

  saveData();
}

async function createServerSetup(guild) {
  await cleanPreviousSetup(guild);

  const roles = await setupRoles(guild);

  db.setup[guild.id].roles.push(
    roles["Kayıtsız"].id,
    roles["Futbolcu"].id,
    roles["Teknik Direktör"].id,
    roles["Muted"].id
  );

  const everyone = guild.roles.everyone;

  for (const [categoryName, channels] of Object.entries(
    SETUP_STRUCTURE
  )) {
    const category = await guild.channels.create({
      name: categoryName,
      type: ChannelType.GuildCategory,
    });

    db.setup[guild.id].categories.push(category.id);

    for (const [channelName] of channels) {
      const permissionOverwrites = [
        {
          id: everyone.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.ReadMessageHistory,
          ],
        },
      ];

      if (categoryName === "📁 YÖNETİM") {
        permissionOverwrites[0] = {
          id: everyone.id,
          deny: [PermissionsBitField.Flags.ViewChannel],
        };

        permissionOverwrites.push({
          id: ADMIN_ROLE_ID,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
          ],
        });
      }

      if (channelName === "📢・duyurular") {
        permissionOverwrites[0].deny = [
          PermissionsBitField.Flags.SendMessages,
        ];
      }

      if (channelName === "🔒・bot-log") {
        permissionOverwrites[0] = {
          id: everyone.id,
          deny: [PermissionsBitField.Flags.ViewChannel],
        };
      }

      const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites,
      });

      db.setup[guild.id].channels.push(channel.id);
    }
  }

  saveData();
}

/* =========================================================
   HOŞ GELDİN / KAYIT
========================================================= */

client.on("guildMemberAdd", async (member) => {
  try {
    const roles = await setupRoles(member.guild);

    const kayitsiz = roles["Kayıtsız"];

    if (kayitsiz) {
      await member.roles.add(kayitsiz).catch(() => {});
    }

    const channel =
      findChannel(member.guild, ["📝・kayıt", "kayıt", "kayit"]) ||
      member.guild.systemChannel;

    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle("👋 United League • Hoş Geldin")
      .setDescription(
        `Hoş geldin ${member}!\n\n` +
          `Kayıt olmak için kayıt yetkilisinin işlemini bekle.\n` +
          `📝 Kayıt Yetkilisi: <@&${REGISTER_ROLE_ID}>`
      )
      .setThumbnail(member.user.displayAvatarURL())
      .setTimestamp();

    await channel.send({
      content: `${member} <@&${REGISTER_ROLE_ID}>`,
      embeds: [embed],
    });
  } catch (err) {
    console.error("guildMemberAdd:", err);
  }
});

/* =========================================================
   SAAT / YARIM SAAT BOT DURUMU
========================================================= */

let lastStatusMinute = -1;

async function sendBotStatus() {
  const channel =
    client.channels.cache.get(ANNOUNCEMENT_CHANNEL_ID) ||
    client.channels.cache.find(
      (c) =>
        c.isTextBased() &&
        ["📢・duyurular", "📢・duyuru"].includes(c.name)
    );

  if (!channel) return;

  const now = new Date();

  const embed = new EmbedBuilder()
    .setTitle("🤖 United League • Bot Durumu")
    .addFields(
      {
        name: "🟢 Durum",
        value: "Aktif",
        inline: true,
      },
      {
        name: "📡 Ping",
        value: `${client.ws.ping}ms`,
        inline: true,
      },
      {
        name: "⏱️ Çalışma Süresi",
        value: formatDuration(client.uptime || 0),
        inline: true,
      },
      {
        name: "🕐 Güncelleme",
        value: now.toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        inline: true,
      }
    )
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch(() => {});
}

setInterval(async () => {
  const now = new Date();
  const minute = now.getMinutes();

  if (
    (minute === 0 || minute === 30) &&
    minute !== lastStatusMinute
  ) {
    lastStatusMinute = minute;
    await sendBotStatus();
  }

  if (minute !== 0 && minute !== 30) {
    lastStatusMinute = -1;
  }
}, 10000);

/* =========================================================
   READY
========================================================= */

client.once("ready", async () => {
  console.log(`✅ ${client.user.tag} aktif.`);

  client.user.setPresence({
    activities: [
      {
        name: "United League | Futbol Rp",
        type: ActivityType.Playing,
      },
    ],
    status: "online",
  });

  console.log("⏰ Saat başı / yarım saat sistemi aktif.");
});

/* =========================================================
   MESAJ SİSTEMİ
========================================================= */

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);

  const command = args.shift()?.toLowerCase();

  if (!command) return;

  const member = message.member;
  const userId = message.author.id;

  try {
    /* =====================================================
       .DİL
    ===================================================== */

    if (command === "dil") {
      const pages = [];

      for (let i = 0; i < LANGUAGES.length; i += 25) {
        pages.push(LANGUAGES.slice(i, i + 25));
      }

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`language_select_0`)
        .setPlaceholder("🌐 Dilinizi seçin")
        .addOptions(
          pages[0].map((lang) => ({
            label: lang[2].slice(0, 100),
            description: lang[3].slice(0, 100),
            value: lang[0],
            emoji: lang[1],
          }))
        );

      const row = new ActionRowBuilder().addComponents(menu);

      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🌐 United League • Dil Seçimi")
            .setDescription(
              "Aşağıdaki menüden kullanmak istediğiniz dili seçin."
            )
            .setTimestamp(),
        ],
        components: [row],
      });

      return;
    }

    /* =====================================================
       .SUNUCUKUR
    ===================================================== */

    if (command === "sunucukur") {
      if (!isAdmin(member)) {
        return message.reply(t(userId, "noPermission"));
      }

      const msg = await message.reply(
        "🏗️ United League sunucusu kuruluyor..."
      );

      await createServerSetup(message.guild);

      await msg.edit(
        "✅ United League sunucusu başarıyla yeniden kuruldu."
      );

      return;
    }

    /* =====================================================
       .KAYIT
    ===================================================== */

    if (command === "k" || command === "kayıt" || command === "kayit") {
      if (!isRegisterStaff(member)) {
        return message.reply(t(userId, "noPermission"));
      }

      const target = message.mentions.members.first();
      const name = args.slice(1).join(" ") || "Oyuncu";

      if (!target) {
        return message.reply("❌ Kullanıcı etiketlemelisin.");
      }

      const footballer = message.guild.roles.cache.find(
        (r) => r.name.toLowerCase() === "futbolcu"
      );

      const director = message.guild.roles.cache.find(
        (r) =>
          r.name.toLowerCase() === "teknik direktör" ||
          r.name.toLowerCase() === "teknik direktor"
      );

      const kayitsiz = message.guild.roles.cache.find(
        (r) => r.name.toLowerCase() === "kayıtsız"
      );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`register_footballer_${target.id}`)
          .setLabel("⚽ Futbolcu")
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId(`register_director_${target.id}`)
          .setLabel("🎩 Teknik Direktör")
          .setStyle(ButtonStyle.Success)
      );

      db.registrations[target.id] = {
        name,
        staff: member.id,
        createdAt: Date.now(),
      };

      saveData();

      await message.reply({
        content: `${target}`,
        embeds: [
          new EmbedBuilder()
            .setTitle("📝 United League • Kayıt")
            .setDescription(
              `**${name}** için kayıt türünü seçin.\n\n` +
                `⚽ Futbolcu\n` +
                `🎩 Teknik Direktör`
            )
            .setTimestamp(),
        ],
        components: [row],
      });

      return;
    }

    /* =====================================================
       .DVER
    ===================================================== */

    if (command === "dver") {
      if (!isValueStaff(member)) {
        return message.reply(t(userId, "noPermission"));
      }

      let remove = false;

      if (args[0]?.toLowerCase() === "sil") {
        remove = true;
        args.shift();
      }

      const target = message.mentions.members.first();

      if (!target) {
        return message.reply("❌ Oyuncu etiketlemelisin.");
      }

      const mentionIndex = args.findIndex((x) =>
        x.includes(target.id)
      );

      let amountText = args[mentionIndex + 1];

      if (!amountText) {
        amountText = args.find((x) => /[0-9]/.test(x));
      }

      const amount = parseMoney(amountText);

      if (!Number.isFinite(amount) || amount <= 0) {
        return message.reply(
          "❌ Geçerli bir değer gir. Örnek: `.dver @oyuncu 5M`"
        );
      }

      const player = getPlayer(target.id);

      if (remove) {
        player.value = Math.max(0, player.value - amount);
      } else {
        player.value += amount;
      }

      updateNickname(target);
      saveData();

      return message.reply(
        `✅ ${target} oyuncusunun değeri **${formatMoney(
          player.value
        )}** oldu.`
      );
    }

    /* =====================================================
       .DEĞER
    ===================================================== */

    if (command === "değer" || command === "deger") {
      const target =
        message.mentions.members.first() || member;

      const player = getPlayer(target.id);

      const embed = new EmbedBuilder()
        .setTitle(`💰 ${t(userId, "value")}`)
        .setDescription(
          `${target}\n\n**${formatMoney(player.value)}**`
        )
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    /* =====================================================
       .DEĞERLER
    ===================================================== */

    if (command === "değerler" || command === "degerler") {
      const list = Object.entries(db.players)
        .sort((a, b) => b[1].value - a[1].value)
        .slice(0, 10);

      if (!list.length) {
        return message.reply("❌ Henüz oyuncu bulunmuyor.");
      }

      let text = "";

      for (let i = 0; i < list.length; i++) {
        const [id, player] = list[i];
        text += `**${i + 1}.** <@${id}> — ${formatMoney(
          player.value
        )}\n`;
      }

      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("💰 United League • Değer Sıralaması")
            .setDescription(text)
            .setTimestamp(),
        ],
      });
    }

    /* =====================================================
       BÜTÇE
    ===================================================== */

    if (command === "bütçe" || command === "butce") {
      const target =
        message.mentions.members.first() || member;

      const player = getPlayer(target.id);

      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`💶 ${t(userId, "budget")}`)
            .setDescription(
              `${target}\n\n**${formatMoney(player.budget)}**`
            )
            .setTimestamp(),
        ],
      });
    }

    /* =====================================================
       .PARA
    ===================================================== */

    if (command === "para") {
      if (!isAdmin(member)) {
        return message.reply(t(userId, "noPermission"));
      }

      const remove = args[0] === "sil";

      if (remove) args.shift();

      const target = message.mentions.members.first();

      if (!target) {
        return message.reply("❌ Oyuncu etiketlemelisin.");
      }

      const amount = parseMoney(
        args.find((x) => /[0-9]/.test(x))
      );

      if (!Number.isFinite(amount) || amount <= 0) {
        return message.reply("❌ Geçerli miktar gir.");
      }

      const player = getPlayer(target.id);

      if (remove) {
        player.budget = Math.max(
          0,
          player.budget - amount
        );
      } else {
        player.budget += amount;
      }

      saveData();

      return message.reply(
        `✅ ${target} bütçesi: **${formatMoney(
          player.budget
        )}**`
      );
    }

    /* =====================================================
       .PARAGÖNDER
    ===================================================== */

    if (
      command === "paragönder" ||
      command === "paragonder"
    ) {
      const target = message.mentions.members.first();

      if (!target || target.id === member.id) {
        return message.reply(
          "❌ Para göndermek için başka bir oyuncu etiketlemelisin."
        );
      }

      const amount = parseMoney(
        args.find((x) => /[0-9]/.test(x))
      );

      if (!Number.isFinite(amount) || amount <= 0) {
        return message.reply("❌ Geçerli miktar gir.");
      }

      const sender = getPlayer(member.id);
      const receiver = getPlayer(target.id);

      if (sender.budget < amount) {
        return message.reply("❌ Bütçen yetersiz.");
      }

      sender.budget -= amount;
      receiver.budget += amount;

      saveData();

      return message.reply(
        `✅ **${formatMoney(amount)}** ${target} oyuncusuna gönderildi.`
      );
    }

    /* =====================================================
       ANTRENMAN
    ===================================================== */

    if (command === "ant" || command === "antrenman") {
      const player = getPlayer(member.id);

      player.trainingProgress++;

      let completed = false;

      if (player.trainingProgress >= 10) {
        player.trainingProgress = 0;
        player.trainings++;
        player.value += 3000000;
        addXP(member.id, 20);
        addAchievement(
          member.id,
          "🏋️ Antrenman Ustası"
        );
        completed = true;
      }

      saveData();

      return message.reply(
        completed
          ? `🏋️ **Antrenman tamamlandı!**\n💰 +3.000.000€\n⭐ +20 XP\n🏆 🏋️ Antrenman Ustası`
          : `🏋️ Antrenman ilerlemesi: **${player.trainingProgress}/10**`
      );
    }

    /* =====================================================
       PENALTI
    ===================================================== */

    if (command === "pen" || command === "penaltı" || command === "penalti") {
      const player = getPlayer(member.id);

      const goal = Math.random() < 0.65;

      if (goal) {
        player.goals++;
        player.penaltyGoals++;
        player.value += 2000000;

        addXP(member.id, 10);
        addAchievement(
          member.id,
          "⚽ Penaltı Uzmanı"
        );

        saveData();

        return message.reply(
          `🥅 **GOOOL!**\n\n💰 +2.000.000€\n⭐ +10 XP`
        );
      }

      saveData();

      return message.reply(
        "🥅 **KAÇTI!** Kaleci penaltıyı kurtardı."
      );
    }

    /* =====================================================
       PROFİL
    ===================================================== */

    if (command === "profil" || command === "istatistik") {
      const target =
        message.mentions.members.first() || member;

      const player = getPlayer(target.id);
      const team = getPlayerTeam(target.id);

      const embed = new EmbedBuilder()
        .setTitle(`👤 ${target.user.username} • Profil`)
        .setThumbnail(target.user.displayAvatarURL())
        .addFields(
          {
            name: "💰 Değer",
            value: formatMoney(player.value),
            inline: true,
          },
          {
            name: "💶 Bütçe",
            value: formatMoney(player.budget),
            inline: true,
          },
          {
            name: "⭐ Seviye",
            value: String(player.level),
            inline: true,
          },
          {
            name: "⚽ Gol",
            value: String(player.goals),
            inline: true,
          },
          {
            name: "🎯 Asist",
            value: String(player.assists),
            inline: true,
          },
          {
            name: "🥅 Penaltı",
            value: String(player.penaltyGoals),
            inline: true,
          },
          {
            name: "🏋️ Antrenman",
            value: `${player.trainingProgress}/10`,
            inline: true,
          },
          {
            name: "🏟️ Takım",
            value: team?.name || t(userId, "noTeam"),
            inline: true,
          }
        )
        .setTimestamp();

      if (player.achievements.length) {
        embed.addFields({
          name: "🏆 Başarımlar",
          value: player.achievements.join("\n"),
        });
      }

      return message.reply({ embeds: [embed] });
    }

    /* =====================================================
       TAKIM OLUŞTUR
    ===================================================== */

    if (
      command === "takımoluştur" ||
      command === "takimolustur"
    ) {
      if (!isDirector(member)) {
        return message.reply(t(userId, "noPermission"));
      }

      const teamName = args.join(" ");

      if (!teamName) {
        return message.reply(
          "❌ Takım adı yazmalısın."
        );
      }

      const already = Object.values(db.teams).find(
        (team) => team.ownerId === member.id
      );

      if (already) {
        return message.reply(
          "❌ Zaten bir takımın bulunuyor."
        );
      }

      const role = await message.guild.roles.create({
        name: teamName.slice(0, 100),
        reason: "United League takım sistemi",
      });

      const id = Date.now().toString();

      db.teams[id] = {
        id,
        name: teamName,
        ownerId: member.id,
        roleId: role.id,
        budget: 10000000,
        formation: "4-3-3",
        players: [],
        wins: 0,
        draws: 0,
        losses: 0,
        points: 0,
        goalsFor: 0,
        goalsAgainst: 0,
      };

      if (!db.setup[message.guild.id]) {
        db.setup[message.guild.id] = {
          channels: [],
          categories: [],
          roles: [],
          teamRoles: [],
        };
      }

      db.setup[message.guild.id].teamRoles.push(role.id);

      const player = getPlayer(member.id);
      player.teamId = id;

      await member.roles.add(role).catch(() => {});

      const directorRole = message.guild.roles.cache.find(
        (r) =>
          r.name.toLowerCase() === "teknik direktör" ||
          r.name.toLowerCase() === "teknik direktor"
      );

      if (directorRole) {
        await member.roles.add(directorRole).catch(() => {});
      }

      saveData();

      return message.reply(
        `🏟️ **${teamName}** başarıyla oluşturuldu!\n💶 Başlangıç bütçesi: **10.000.000€**\n📋 Formasyon: **4-3-3**`
      );
    }

    /* =====================================================
       TAKIM
    ===================================================== */

    if (
      command === "takım" ||
      command === "takim" ||
      command === "takımım" ||
      command === "takimim"
    ) {
      const player = getPlayer(member.id);

      if (!player.teamId || !db.teams[player.teamId]) {
        return message.reply("❌ Bir takımın bulunmuyor.");
      }

      const team = db.teams[player.teamId];

      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`🏟️ ${team.name}`)
            .addFields(
              {
                name: "👔 Teknik Direktör",
                value: `<@${team.ownerId}>`,
                inline: true,
              },
              {
                name: "💶 Bütçe",
                value: formatMoney(team.budget),
                inline: true,
              },
              {
                name: "📋 Formasyon",
                value: team.formation,
                inline: true,
              },
              {
                name: "👥 Oyuncu",
                value: String(team.players.length),
                inline: true,
              },
              {
                name: "🏆 Puan",
                value: String(team.points),
                inline: true,
              }
            )
            .setTimestamp(),
        ],
      });
    }

    /* =====================================================
       TAKIMLAR
    ===================================================== */

    if (command === "takımlar" || command === "takimlar") {
      const teams = Object.values(db.teams);

      if (!teams.length) {
        return message.reply("❌ Henüz takım yok.");
      }

      const text = teams
        .map(
          (team, i) =>
            `**${i + 1}. ${team.name}** — ${team.points} puan`
        )
        .join("\n");

      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🏟️ United League • Takımlar")
            .setDescription(text)
            .setTimestamp(),
        ],
      });
    }

    /* =====================================================
       KADRO
    ===================================================== */

    if (command === "kadro") {
      const player = getPlayer(member.id);

      if (!player.teamId || !db.teams[player.teamId]) {
        return message.reply("❌ Bir takımın bulunmuyor.");
      }

      const team = db.teams[player.teamId];

      const text =
        team.players.length > 0
          ? team.players
              .map((id, i) => `${i + 1}. <@${id}>`)
              .join("\n")
          : "Henüz oyuncu bulunmuyor.";

      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`📋 ${team.name} • Kadro`)
            .setDescription(text)
            .setTimestamp(),
        ],
      });
    }

    /* =====================================================
       KADRO ÇIKAR
    ===================================================== */

    if (
      command === "kadrocikar" ||
      command === "kadroyuncucikar"
    ) {
      if (!isDirector(member)) {
        return message.reply(t(userId, "noPermission"));
      }

      const target = message.mentions.members.first();

      if (!target) {
        return message.reply("❌ Oyuncu etiketlemelisin.");
      }

      const directorPlayer = getPlayer(member.id);

      if (
        !directorPlayer.teamId ||
        !db.teams[directorPlayer.teamId]
      ) {
        return message.reply("❌ Bir takımın bulunmuyor.");
      }

      const team = db.teams[directorPlayer.teamId];
      const targetPlayer = getPlayer(target.id);

      team.players = team.players.filter(
        (id) => id !== target.id
      );

      if (targetPlayer.teamId === team.id) {
        targetPlayer.teamId = null;
      }

      const role = message.guild.roles.cache.get(
        team.roleId
      );

      if (role) {
        await target.roles.remove(role).catch(() => {});
      }

      saveData();

      return message.reply(
        `✅ ${target} kadrodan çıkarıldı.`
      );
    }

    /* =====================================================
       FORMASYON
    ===================================================== */

    if (command === "formasyon") {
      if (!isDirector(member)) {
        return message.reply(t(userId, "noPermission"));
      }

      const formation = args[0];

      if (!formation) {
        return message.reply(
          "❌ Örnek: `.formasyon 4-3-3`"
        );
      }

      const player = getPlayer(member.id);

      if (!player.teamId || !db.teams[player.teamId]) {
        return message.reply("❌ Bir takımın bulunmuyor.");
      }

      db.teams[player.teamId].formation = formation;

      saveData();

      return message.reply(
        `✅ Formasyon **${formation}** olarak ayarlandı.`
      );
    }

    /* =====================================================
       TAKIM BÜTÇE
    ===================================================== */

    if (
      command === "takımbütçe" ||
      command === "takimbutce"
    ) {
      const player = getPlayer(member.id);

      if (!player.teamId || !db.teams[player.teamId]) {
        return message.reply("❌ Bir takımın bulunmuyor.");
      }

      const team = db.teams[player.teamId];

      return message.reply(
        `💶 **${team.name}** takım bütçesi: **${formatMoney(
          team.budget
        )}**`
      );
    }

    /* =====================================================
       TAKIM PARA
    ===================================================== */

    if (
      command === "takımpara" ||
      command === "takimpara"
    ) {
      if (!isDirector(member) && !isAdmin(member)) {
        return message.reply(t(userId, "noPermission"));
      }

      const player = getPlayer(member.id);

      if (!player.teamId || !db.teams[player.teamId]) {
        return message.reply("❌ Bir takımın bulunmuyor.");
      }

      const amount = parseMoney(
        args.find((x) => /[0-9]/.test(x))
      );

      if (!Number.isFinite(amount) || amount <= 0) {
        return message.reply("❌ Geçerli miktar gir.");
      }

      db.teams[player.teamId].budget += amount;

      saveData();

      return message.reply(
        `💶 Takım bütçesine **${formatMoney(
          amount
        )}** eklendi.`
      );
    }

    /* =====================================================
       MAÇ
    ===================================================== */

    if (command === "maç" || command === "mac") {
      if (!isAdmin(member) && !isDirector(member)) {
        return message.reply(t(userId, "noPermission"));
      }

      const mentioned = [...message.mentions.members.values()];

      if (mentioned.length < 2) {
        return message.reply(
          "❌ İki takımın teknik direktörünü etiketlemelisin."
        );
      }

      const p1 = getPlayer(mentioned[0].id);
      const p2 = getPlayer(mentioned[1].id);

      if (!p1.teamId || !p2.teamId) {
        return message.reply(
          "❌ İki oyuncunun da takımı bulunmalı."
        );
      }

      const team1 = db.teams[p1.teamId];
      const team2 = db.teams[p2.teamId];

      if (!team1 || !team2) {
        return message.reply("❌ Takım bulunamadı.");
      }

      const score1 = Math.floor(Math.random() * 5);
      const score2 = Math.floor(Math.random() * 5);

      team1.goalsFor += score1;
      team1.goalsAgainst += score2;

      team2.goalsFor += score2;
      team2.goalsAgainst += score1;

      if (score1 > score2) {
        team1.wins++;
        team2.losses++;
        team1.points += 3;
      } else if (score2 > score1) {
        team2.wins++;
        team1.losses++;
        team2.points += 3;
      } else {
        team1.draws++;
        team2.draws++;
        team1.points++;
        team2.points++;
      }

      team1.players.forEach((id) => {
        getPlayer(id).matches++;
      });

      team2.players.forEach((id) => {
        getPlayer(id).matches++;
      });

      db.matches.push({
        id: Date.now().toString(),
        team1: team1.id,
        team2: team2.id,
        score1,
        score2,
        createdAt: Date.now(),
      });

      saveData();

      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("⚽ United League • Maç Sonucu")
            .setDescription(
              `### ${team1.name} **${score1} - ${score2}** ${team2.name}`
            )
            .addFields(
              {
                name: "🏟️ Formasyonlar",
                value: `${team1.formation} — ${team2.formation}`,
              }
            )
            .setTimestamp(),
        ],
      });
    }

    /* =====================================================
       PUAN
    ===================================================== */

    if (command === "puan" || command === "lig") {
      const teams = Object.values(db.teams)
        .sort((a, b) => b.points - a.points);

      const text =
        teams.length > 0
          ? teams
              .map(
                (team, i) =>
                  `**${i + 1}. ${team.name}** — ${team.points} P`
              )
              .join("\n")
          : "Henüz takım bulunmuyor.";

      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🏆 United League • Puan Durumu")
            .setDescription(text)
            .setTimestamp(),
        ],
      });
    }

    /* =====================================================
       MAÇLAR
    ===================================================== */

    if (command === "maçlar" || command === "maclar") {
      const matches = db.matches.slice(-10).reverse();

      if (!matches.length) {
        return message.reply("❌ Henüz maç oynanmadı.");
      }

      const text = matches
        .map((m) => {
          const t1 = db.teams[m.team1];
          const t2 = db.teams[m.team2];

          return `${t1?.name || "?"} **${m.score1}-${m.score2}** ${
            t2?.name || "?"
          }`;
        })
        .join("\n");

      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("⚽ Son Maçlar")
            .setDescription(text)
            .setTimestamp(),
        ],
      });
    }

    /* =====================================================
       GOL KRALLIĞI
    ===================================================== */

    if (
      command === "golkrallığı" ||
      command === "golkralligi"
    ) {
      const list = Object.entries(db.players)
        .sort((a, b) => b[1].goals - a[1].goals)
        .slice(0, 10);

      const text =
        list.length > 0
          ? list
              .map(
                ([id, p], i) =>
                  `**${i + 1}.** <@${id}> — ${p.goals} gol`
              )
              .join("\n")
          : "Henüz gol istatistiği yok.";

      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🥇 Gol Krallığı")
            .setDescription(text),
        ],
      });
    }

    /* =====================================================
       ASİST KRALLIĞI
    ===================================================== */

    if (
      command === "asistkrallığı" ||
      command === "asistkralligi"
    ) {
      const list = Object.entries(db.players)
        .sort((a, b) => b[1].assists - a[1].assists)
        .slice(0, 10);

      const text =
        list.length > 0
          ? list
              .map(
                ([id, p], i) =>
                  `**${i + 1}.** <@${id}> — ${p.assists} asist`
              )
              .join("\n")
          : "Henüz asist istatistiği yok.";

      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🎯 Asist Krallığı")
            .setDescription(text),
        ],
      });
    }

    /* =====================================================
       KAP
    ===================================================== */

    if (command === "kap") {
      if (!isDirector(member) && !isAdmin(member)) {
        return message.reply(t(userId, "noPermission"));
      }

      const target = message.mentions.members.first();

      if (!target) {
        return message.reply(
          "❌ Transfer etmek istediğin oyuncuyu etiketle."
        );
      }

      const player = getPlayer(member.id);

      if (!player.teamId || !db.teams[player.teamId]) {
        return message.reply(
          "❌ Önce bir takımın olmalı."
        );
      }

      const team = db.teams[player.teamId];

      const modal = new ModalBuilder()
        .setCustomId(`kap_modal_${target.id}_${team.id}`)
        .setTitle("🔄 Transfer KAP");

      const fee = new TextInputBuilder()
        .setCustomId("kap_fee")
        .setLabel("Bonservis")
        .setPlaceholder("Örn: 15M")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const salary = new TextInputBuilder()
        .setCustomId("kap_salary")
        .setLabel("Maaş")
        .setPlaceholder("Örn: 500K")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const duration = new TextInputBuilder()
        .setCustomId("kap_duration")
        .setLabel("Sözleşme süresi")
        .setPlaceholder("Örn: 3 yıl")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const position = new TextInputBuilder()
        .setCustomId("kap_position")
        .setLabel("Oyuncu pozisyonu")
        .setPlaceholder("Örn: SNT")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const details = new TextInputBuilder()
        .setCustomId("kap_details")
        .setLabel("Ek şartlar")
        .setPlaceholder("Transferle ilgili diğer bilgiler")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(fee),
        new ActionRowBuilder().addComponents(salary),
        new ActionRowBuilder().addComponents(duration),
        new ActionRowBuilder().addComponents(position),
        new ActionRowBuilder().addComponents(details)
      );

      await message.reply(
        "📄 KAP formu açıldı. Bilgileri doldur."
      );

      await member
        .send()
        .catch(() => {});

      await member.user
        .send({
          content:
            "KAP formunu açmak için Discord'un açtığı formu kullan.",
        })
        .catch(() => {});

      /*
        Discord.js modalı yalnızca interaction üzerinden
        gösterebildiği için mesajdan modal doğrudan açılamaz.
        Bu nedenle aşağıda sunucu mesajına KAP form butonu
        oluşturuluyor.
      */

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`open_kap_${target.id}_${team.id}`)
          .setLabel("📄 KAP Formunu Aç")
          .setStyle(ButtonStyle.Primary)
      );

      await message.channel.send({
        content: `${member} → ${target}`,
        embeds: [
          new EmbedBuilder()
            .setTitle("🔄 KAP Başlatıldı")
            .setDescription(
              `${target} oyuncusu için transfer formunu açmak üzere aşağıdaki butona bas.`
            ),
        ],
        components: [row],
      });

      return;
    }

    /* =====================================================
       TICKET PANEL
    ===================================================== */

    if (command === "ticketpanel") {
      if (!isAdmin(member)) {
        return message.reply(t(userId, "noPermission"));
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_create")
          .setLabel("🎫 Ticket Aç")
          .setStyle(ButtonStyle.Primary)
      );

      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🎫 United League • Destek")
            .setDescription(
              "Destek almak için aşağıdaki **Ticket Aç** butonuna bas."
            )
            .setTimestamp(),
        ],
        components: [row],
      });
    }

    /* =====================================================
       ÇEKİLİŞ
    ===================================================== */

    if (command === "çekiliş" || command === "cekilis") {
      if (!isAdmin(member)) {
        return message.reply(t(userId, "noPermission"));
      }

      const prize = args[0];
      const durationText = args[1];

      const prizeValue = parseMoney(prize);

      if (!Number.isFinite(prizeValue) || !durationText) {
        return message.reply(
          "❌ Örnek: `.çekiliş 5M 5saat`"
        );
      }

      const duration = parseDuration(durationText);

      if (!duration || duration <= 0) {
        return message.reply("❌ Geçerli süre gir.");
      }

      const id = Date.now().toString();

      db.giveaways[id] = {
        id,
        prize: prizeValue,
        channelId: message.channel.id,
        participants: [],
        endAt: Date.now() + duration,
        ended: false,
      };

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`giveaway_join_${id}`)
          .setLabel("🎁 Katıl")
          .setStyle(ButtonStyle.Success)
      );

      const sent = await message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("🎁 United League • Çekiliş")
            .setDescription(
              `💰 Ödül: **${formatMoney(
                prizeValue
              )}**\n⏱️ Süre: **${durationText}**\n\nKatılmak için butona bas.`
            )
            .setTimestamp(),
        ],
        components: [row],
      });

      db.giveaways[id].messageId = sent.id;

      saveData();

      setTimeout(
        () => finishGiveaway(id),
        Math.min(duration, 2147483647)
      );

      return;
    }

    /* =====================================================
       YENİ KAZANAN
    ===================================================== */

    if (
      command === "yenikazanan" ||
      command === "yenikazanan"
    ) {
      if (!isAdmin(member)) {
        return message.reply(t(userId, "noPermission"));
      }

      return message.reply(
        "ℹ️ Yeni kazanan sistemi aktif çekiliş üzerinden çalışır."
      );
    }

    /* =====================================================
       KICK
    ===================================================== */

    if (command === "kick") {
      if (!isAdmin(member)) {
        return message.reply(t(userId, "noPermission"));
      }

      const target = message.mentions.members.first();

      if (!target) {
        return message.reply("❌ Kullanıcı etiketlemelisin.");
      }

      await target.kick("United League kick").catch(() => {});

      return message.reply(
        `👢 ${target.user.tag} sunucudan atıldı.`
      );
    }

    /* =====================================================
       BAN
    ===================================================== */

    if (command === "ban") {
      if (!isAdmin(member)) {
        return message.reply(t(userId, "noPermission"));
      }

      const target = message.mentions.members.first();

      if (!target) {
        return message.reply("❌ Kullanıcı etiketlemelisin.");
      }

      await target.ban({
        reason: "United League ban",
      }).catch(() => {});

      return message.reply(
        `🔨 ${target.user.tag} yasaklandı.`
      );
    }

    /* =====================================================
       MUTE
    ===================================================== */

    if (command === "mute") {
      if (!isAdmin(member)) {
        return message.reply(t(userId, "noPermission"));
      }

      const target = message.mentions.members.first();

      if (!target) {
        return message.reply("❌ Kullanıcı etiketlemelisin.");
      }

      const role = message.guild.roles.cache.find(
        (r) => r.name.toLowerCase() === "muted"
      );

      if (!role) {
        return message.reply("❌ Muted rolü bulunamadı.");
      }

      await target.roles.add(role).catch(() => {});

      return message.reply(
        `🔇 ${target} susturuldu.`
      );
    }

    /* =====================================================
       UNMUTE
    ===================================================== */

    if (command === "unmute") {
      if (!isAdmin(member)) {
        return message.reply(t(userId, "noPermission"));
      }

      const target = message.mentions.members.first();

      if (!target) {
        return message.reply("❌ Kullanıcı etiketlemelisin.");
      }

      const role = message.guild.roles.cache.find(
        (r) => r.name.toLowerCase() === "muted"
      );

      if (role) {
        await target.roles.remove(role).catch(() => {});
      }

      return message.reply(
        `🔊 ${target} susturması kaldırıldı.`
      );
    }

    /* =====================================================
       SİL
    ===================================================== */

    if (command === "sil") {
      if (!isAdmin(member)) {
        return message.reply(t(userId, "noPermission"));
      }

      const amount = parseInt(args[0]);

      if (
        !Number.isInteger(amount) ||
        amount < 1 ||
        amount > 1000
      ) {
        return message.reply(
          "❌ 1 ile 1000 arasında bir miktar gir."
        );
      }

      await message.channel.bulkDelete(amount, true);

      const msg = await message.channel.send(
        `🗑️ **${amount}** mesaj silindi.`
      );

      setTimeout(() => msg.delete().catch(() => {}), 3000);

      return;
    }

    /* =====================================================
       KİLİTLE
    ===================================================== */

    if (command === "kilitle") {
      if (!isAdmin(member)) {
        return message.reply(t(userId, "noPermission"));
      }

      await message.channel.permissionOverwrites.edit(
        message.guild.roles.everyone,
        {
          SendMessages: false,
        }
      );

      return message.reply("🔒 Kanal kilitlendi.");
    }

    /* =====================================================
       KİLİT AÇ
    ===================================================== */

    if (
      command === "kilitaç" ||
      command === "kilitac"
    ) {
      if (!isAdmin(member)) {
        return message.reply(t(userId, "noPermission"));
      }

      await message.channel.permissionOverwrites.edit(
        message.guild.roles.everyone,
        {
          SendMessages: true,
        }
      );

      return message.reply("🔓 Kanalın kilidi açıldı.");
    }

    /* =====================================================
       TWEET
    ===================================================== */

    if (command === "tweet") {
      const content = args.join(" ");

      if (!content && !message.attachments.size) {
        return message.reply("❌ Tweet içeriği yaz.");
      }

      const embed = new EmbedBuilder()
        .setTitle("🐦 United League • Tweet")
        .setDescription(content || " ")
        .setAuthor({
          name: message.member.displayName,
          iconURL: message.author.displayAvatarURL(),
        })
        .setTimestamp();

      const attachment = message.attachments.first();

      if (attachment) {
        embed.setImage(attachment.url);
      }

      return message.channel.send({
        embeds: [embed],
      });
    }

    /* =====================================================
       HABER
    ===================================================== */

    if (command === "haber") {
      if (!isAdmin(member)) {
        return message.reply(t(userId, "noPermission"));
      }

      const content = args.join(" ");

      if (!content) {
        return message.reply("❌ Haber metni yaz.");
      }

      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("📰 United League • Haber")
            .setDescription(content)
            .setTimestamp(),
        ],
      });
    }

    /* =====================================================
       EMBED
    ===================================================== */

    if (command === "embed") {
      if (!isAdmin(member)) {
        return message.reply(t(userId, "noPermission"));
      }

      const content = args.join(" ");

      if (!content) {
        return message.reply("❌ Embed mesajı yaz.");
      }

      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("United League")
            .setDescription(content)
            .setTimestamp(),
        ],
      });
    }

    /* =====================================================
       DM
    ===================================================== */

    if (command === "dm") {
      if (!isAdmin(member)) {
        return message.reply(t(userId, "noPermission"));
      }

      if (args[0]?.toLowerCase() === "all") {
        args.shift();

        const content = args.join(" ");

        if (!content) {
          return message.reply("❌ Mesaj yaz.");
        }

        let count = 0;

        for (const target of message.guild.members.cache.values()) {
          if (target.user.bot) continue;

          await target
            .send({
              embeds: [
                new EmbedBuilder()
                  .setTitle("📢 United League")
                  .setDescription(content)
                  .setFooter({
                    text: "United League • Resmi Bildirim",
                  })
                  .setTimestamp(),
              ],
            })
            .then(() => count++)
            .catch(() => {});
        }

        return message.reply(
          `✅ ${count} kullanıcıya DM gönderildi.`
        );
      }

      const target = message.mentions.members.first();

      if (!target) {
        return message.reply(
          "❌ Kullanıcı etiketlemelisin."
        );
      }

      const content = args
        .filter((x) => !x.includes(target.id))
        .join(" ");

      if (!content) {
        return message.reply("❌ Mesaj yaz.");
      }

      await target.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("📢 United League")
            .setDescription(content)
            .setFooter({
              text: "United League • Resmi Bildirim",
            })
            .setTimestamp(),
        ],
      }).catch(() => {});

      return message.reply("✅ DM gönderildi.");
    }

    /* =====================================================
       REKLAM PAKETLERİ
    ===================================================== */

    if (
      command === "reklampaketleri" ||
      command === "reklam"
    ) {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("📢 United League • Reklam Paketleri")
            .setDescription(
              "🥉 **Bronz:** 150K\n" +
                "🥈 **Gümüş:** 300K\n" +
                "🥇 **Altın:** 600K\n" +
                "💎 **Platin:** 1.2M\n" +
                "👑 **Legendary:** 2.4M\n" +
                "🌟 **Ultimate:** 4.8M\n\n" +
                "@everyone — 100K\n" +
                "@here — 50K\n\n" +
                "600K sonrası haklar artırılır.\n" +
                "Maksimum 5 @everyone / @here hakkı.\n" +
                "700K sonrası özel reklam kanalı."
            ),
        ],
      });
    }

    /* =====================================================
       ŞİRKETLER
    ===================================================== */

    if (
      command === "şirketler" ||
      command === "sirketler"
    ) {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🏢 Şirketler")
            .setDescription(
              "✈️ Emirates — %65\n" +
                "👕 Adidas — %60\n" +
                "👟 Puma — %55\n" +
                "✔️ Nike — %50\n" +
                "🥤 Coca-Cola — %45\n" +
                "🥤 Pepsi — %40\n" +
                "⚡ Red Bull — %35\n" +
                "🚘 Mercedes — %30"
            ),
        ],
      });
    }

    /* =====================================================
       ŞİRKET BAŞVURU
    ===================================================== */

    if (
      command === "şirketbaşvur" ||
      command === "sirketbasvur"
    ) {
      const company = args.join(" ");

      if (!company) {
        return message.reply(
          "❌ Şirket adı yazmalısın."
        );
      }

      const channel =
        findChannel(message.guild, [
          "🏢・şirketler",
          "şirketler",
          "sirketler",
        ]) || message.channel;

      await channel.send(
        `🏢 **Şirket Başvurusu**\n\n👤 Başvuran: ${member}\n🏢 Şirket: **${company}**`
      );

      return message.reply(
        "✅ Şirket başvurun iletildi."
      );
    }

    /* =====================================================
       SPONSORLAR
    ===================================================== */

    if (command === "sponsorlar") {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🤝 Sponsorlar")
            .setDescription(
              "✈️ Emirates — %65\n" +
                "👕 Adidas — %75\n" +
                "👟 Puma — %55\n" +
                "✔️ Nike — %65\n" +
                "🥤 Coca-Cola — %45\n" +
                "🥤 Pepsi — %40\n" +
                "⚡ Red Bull — %35\n" +
                "🚘 Mercedes — %30"
            ),
        ],
      });
    }

    /* =====================================================
       SPONSOR BAŞVURU
    ===================================================== */

    if (
      command === "sponsorbaşvur" ||
      command === "sponsorbasvur"
    ) {
      const sponsor = args.join(" ");

      if (!sponsor) {
        return message.reply(
          "❌ Sponsor adını yazmalısın."
        );
      }

      const channel =
        findChannel(message.guild, [
          "🤝・sponsorlar",
          "sponsorlar",
        ]) || message.channel;

      await channel.send(
        `🤝 **Sponsor Başvurusu**\n\n👤 Başvuran: ${member}\n🏢 Sponsor: **${sponsor}**`
      );

      return message.reply(
        "✅ Sponsor başvurun iletildi."
      );
    }

    /* =====================================================
       SEZON
    ===================================================== */

    if (command === "sezon") {
      const start = new Date(db.season.startedAt);

      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🏆 United League • Sezon")
            .setDescription(
              `**Sezon:** ${db.season.number}\n` +
                `**Başlangıç:** ${start.toLocaleDateString(
                  "tr-TR"
                )}`
            )
            .setTimestamp(),
        ],
      });
    }
  } catch (err) {
    console.error("Komut hatası:", err);

    await message
      .reply("❌ Komut çalıştırılırken bir hata oluştu.")
      .catch(() => {});
  }
});

/* =========================================================
   SÜRE PARSE
========================================================= */

function parseDuration(input) {
  if (!input) return null;

  const match = String(input)
    .toLowerCase()
    .match(/^([\d.]+)(s|sn|dk|m|sa|saat|h|d)$/);

  if (!match) return null;

  const number = Number(match[1]);
  const unit = match[2];

  if (!Number.isFinite(number)) return null;

  if (unit === "s" || unit === "sn") {
    return number * 1000;
  }

  if (unit === "dk" || unit === "m") {
    return number * 60 * 1000;
  }

  if (unit === "sa" || unit === "saat" || unit === "h") {
    return number * 60 * 60 * 1000;
  }

  if (unit === "d") {
    return number * 24 * 60 * 60 * 1000;
  }

  return null;
}

/* =========================================================
   INTERACTIONS
========================================================= */

client.on("interactionCreate", async (interaction) => {
  try {
    /* =====================================================
       DİL SEÇİMİ
    ===================================================== */

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId.startsWith("language_select_")
    ) {
      const langCode = interaction.values[0];

      await setLanguage(interaction.member, langCode);

      const lang = LANGUAGES.find(
        (x) => x[0] === langCode
      );

      return interaction.reply({
        content: `${lang[1]} ${TEXT[langCode]?.languageSelected || TEXT.tr.languageSelected}`,
        ephemeral: true,
      });
    }

    /* =====================================================
       KAYIT BUTONLARI
    ===================================================== */

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("register_")
    ) {
      const parts = interaction.customId.split("_");

      const type = parts[1];
      const targetId = parts[2];

      if (interaction.user.id !== targetId) {
        return interaction.reply({
          content: "❌ Bu kayıt butonu sana ait değil.",
          ephemeral: true,
        });
      }

      const member = interaction.member;
      const guild = interaction.guild;

      const roles = await setupRoles(guild);

      const footballer = roles["Futbolcu"];
      const director = roles["Teknik Direktör"];
      const kayitsiz = roles["Kayıtsız"];

      if (kayitsiz) {
        await member.roles.remove(kayitsiz).catch(() => {});
      }

      if (type === "footballer") {
        await member.roles.add(footballer).catch(() => {});

        const player = getPlayer(member.id);
        player.registered = true;
        player.role = "Futbolcu";

        db.registrations[member.id] = {
          ...(db.registrations[member.id] || {}),
          type: "Futbolcu",
          completedAt: Date.now(),
        };

        saveData();

        await interaction.reply({
          content:
            "⚽ Kayıt tamamlandı. Futbolcu rolün verildi.",
          ephemeral: true,
        });
      }

      if (type === "director") {
        await member.roles.add(director).catch(() => {});

        const player = getPlayer(member.id);
        player.registered = true;
        player.role = "Teknik Direktör";

        db.registrations[member.id] = {
          ...(db.registrations[member.id] || {}),
          type: "Teknik Direktör",
          completedAt: Date.now(),
        };

        saveData();

        await interaction.reply({
          content:
            "🎩 Kayıt tamamlandı. Teknik Direktör rolün verildi.",
          ephemeral: true,
        });
      }

      const kayıt =
        findChannel(guild, ["📝・kayıt", "kayıt", "kayit"]);

      const sohbet =
        findChannel(guild, ["💬・sohbet", "sohbet"]);

      const staff = `<@&${REGISTER_ROLE_ID}>`;

      if (kayıt) {
        await kayıt
          .send(
            `🎉 ${member} kayıt oldu! ${staff}`
          )
          .catch(() => {});
      }

      if (sohbet) {
        await sohbet
          .send(
            `👋 **Hoş geldin ${member}!** United League'e hoş geldin.`
          )
          .catch(() => {});
      }

      return;
    }

    /* =====================================================
       TICKET OLUŞTUR
    ===================================================== */

    if (
      interaction.isButton() &&
      interaction.customId === "ticket_create"
    ) {
      const guild = interaction.guild;
      const member = interaction.member;

      const existing = guild.channels.cache.find(
        (channel) =>
          channel.name ===
          `ticket-${member.user.username.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 15)}`
      );

      if (existing) {
        return interaction.reply({
          content: `❌ Zaten açık bir ticketın var: ${existing}`,
          ephemeral: true,
        });
      }

      let category = guild.channels.cache.find(
        (c) =>
          c.type === ChannelType.GuildCategory &&
          c.name === "📁 KAYIT & DESTEK"
      );

      if (!category) {
        category = await guild.channels.create({
          name: "📁 KAYIT & DESTEK",
          type: ChannelType.GuildCategory,
        });
      }

      const channelName =
        `ticket-${member.user.username
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
          .slice(0, 15)}`;

      const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionsBitField.Flags.ViewChannel],
          },
          {
            id: member.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.AttachFiles,
            ],
          },
          {
            id: ADMIN_ROLE_ID,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
            ],
          },
        ],
      });

      const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_close")
          .setLabel("🔒 Ticket Kapat")
          .setStyle(ButtonStyle.Danger)
      );

      await channel.send({
        content: `${member} <@&${ADMIN_ROLE_ID}>`,
        embeds: [
          new EmbedBuilder()
            .setTitle("🎫 United League • Ticket")
            .setDescription(
              "Destek ekibi kısa süre içerisinde ilgilenecektir.\n\n" +
                "Ticketı kapatmak için aşağıdaki butonu kullan."
            )
            .setTimestamp(),
        ],
        components: [closeRow],
      });

      return interaction.reply({
        content: `✅ Ticket oluşturuldu: ${channel}`,
        ephemeral: true,
      });
    }

    /* =====================================================
       TICKET KAPAT
    ===================================================== */

    if (
      interaction.isButton() &&
      interaction.customId === "ticket_close"
    ) {
      if (
        !isAdmin(interaction.member) &&
        !interaction.channel.name.startsWith("ticket-")
      ) {
        return interaction.reply({
          content: "❌ Bu ticketı kapatamazsın.",
          ephemeral: true,
        });
      }

      await interaction.reply(
        "🔒 Ticket kapatılıyor..."
      );

      setTimeout(() => {
        interaction.channel
          .delete("United League ticket kapatıldı")
          .catch(() => {});
      }, 1500);

      return;
    }

    /* =====================================================
       KAP FORM BUTONU
    ===================================================== */

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("open_kap_")
    ) {
      const parts = interaction.customId.split("_");

      const targetId = parts[2];
      const teamId = parts[3];

      if (
        !isDirector(interaction.member) &&
        !isAdmin(interaction.member)
      ) {
        return interaction.reply({
          content: t(
            interaction.user.id,
            "noPermission"
          ),
          ephemeral: true,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(
          `kap_modal_${targetId}_${teamId}`
        )
        .setTitle("🔄 Transfer KAP");

      const fee = new TextInputBuilder()
        .setCustomId("kap_fee")
        .setLabel("Bonservis")
        .setPlaceholder("15M")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const salary = new TextInputBuilder()
        .setCustomId("kap_salary")
        .setLabel("Maaş")
        .setPlaceholder("500K")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const duration = new TextInputBuilder()
        .setCustomId("kap_duration")
        .setLabel("Sözleşme süresi")
        .setPlaceholder("3 yıl")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const position = new TextInputBuilder()
        .setCustomId("kap_position")
        .setLabel("Oyuncu pozisyonu")
        .setPlaceholder("SNT")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const details = new TextInputBuilder()
        .setCustomId("kap_details")
        .setLabel("Ek şartlar")
        .setPlaceholder("Ek bilgiler")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(fee),
        new ActionRowBuilder().addComponents(salary),
        new ActionRowBuilder().addComponents(duration),
        new ActionRowBuilder().addComponents(position),
        new ActionRowBuilder().addComponents(details)
      );

      return interaction.showModal(modal);
    }

    /* =====================================================
       KAP MODAL
    ===================================================== */

    if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith("kap_modal_")
    ) {
      const parts = interaction.customId.split("_");

      const targetId = parts[2];
      const teamId = parts[3];

      const fee = parseMoney(
        interaction.fields.getTextInputValue("kap_fee")
      );

      const salary =
        interaction.fields.getTextInputValue("kap_salary");

      const duration =
        interaction.fields.getTextInputValue("kap_duration");

      const position =
        interaction.fields.getTextInputValue("kap_position");

      const details =
        interaction.fields.getTextInputValue("kap_details") ||
        "Belirtilmedi.";

      if (!Number.isFinite(fee) || fee <= 0) {
        return interaction.reply({
          content: "❌ Geçersiz bonservis.",
          ephemeral: true,
        });
      }

      const team = db.teams[teamId];

      if (!team) {
        return interaction.reply({
          content: "❌ Takım bulunamadı.",
          ephemeral: true,
        });
      }

      const kapId = Date.now().toString();

      db.kap[kapId] = {
        id: kapId,
        playerId: targetId,
        teamId,
        creatorId: interaction.user.id,
        fee,
        salary,
        duration,
        position,
        details,
        status: "pending",
        createdAt: Date.now(),
      };

      saveData();

      const channel =
        findChannel(interaction.guild, [
          "📄・kap",
          "🔄・transferler",
          "kap",
          "transferler",
        ]) || interaction.channel;

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`kap_accept_${kapId}`)
          .setLabel("✅ Kabul Et")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId(`kap_reject_${kapId}`)
          .setLabel("❌ Reddet")
          .setStyle(ButtonStyle.Danger)
      );

      await channel.send({
        content: `<@${targetId}>`,
        embeds: [
          new EmbedBuilder()
            .setTitle("🔄 United League • KAP")
            .addFields(
              {
                name: "👤 Oyuncu",
                value: `<@${targetId}>`,
                inline: true,
              },
              {
                name: "🏟️ Takım",
                value: team.name,
                inline: true,
              },
              {
                name: "💰 Bonservis",
                value: formatMoney(fee),
                inline: true,
              },
              {
                name: "💶 Maaş",
                value: salary,
                inline: true,
              },
              {
                name: "📄 Sözleşme",
                value: duration,
                inline: true,
              },
              {
                name: "⚽ Pozisyon",
                value: position,
                inline: true,
              },
              {
                name: "📋 Ek şartlar",
                value: details.slice(0, 1024),
              }
            )
            .setFooter({
              text: `KAP ID: ${kapId}`,
            })
            .setTimestamp(),
        ],
        components: [row],
      });

      return interaction.reply({
        content:
          "✅ KAP oluşturuldu ve sunucudaki transfer kanalına gönderildi.",
        ephemeral: true,
      });
    }

    /* =====================================================
       KAP KABUL / RED
    ===================================================== */

    if (
      interaction.isButton() &&
      (
        interaction.customId.startsWith("kap_accept_") ||
        interaction.customId.startsWith("kap_reject_")
      )
    ) {
      const [action, type, kapId] =
        interaction.customId.split("_");

      const kap = db.kap[kapId];

      if (!kap) {
        return interaction.reply({
          content: "❌ KAP bulunamadı.",
          ephemeral: true,
        });
      }

      if (kap.status !== "pending") {
        return interaction.reply({
          content: "❌ Bu KAP zaten sonuçlandı.",
          ephemeral: true,
        });
      }

      if (interaction.user.id !== kap.playerId) {
        return interaction.reply({
          content:
            "❌ Bu KAP yalnızca oyuncu tarafından cevaplanabilir.",
          ephemeral: true,
        });
      }

      if (type === "reject") {
        kap.status = "rejected";

        saveData();

        return interaction.update({
          content: `❌ KAP <@${kap.playerId}> tarafından reddedildi.`,
          embeds: [],
          components: [],
        });
      }

      const player = getPlayer(kap.playerId);
      const team = db.teams[kap.teamId];

      if (!team) {
        return interaction.reply({
          content: "❌ Takım bulunamadı.",
          ephemeral: true,
        });
      }

      if (team.budget < kap.fee) {
        return interaction.reply({
          content:
            "❌ Takımın bu transfer için yeterli bütçesi yok.",
          ephemeral: true,
        });
      }

      /* Eski takımdan çıkar */
      if (player.teamId && db.teams[player.teamId]) {
        const oldTeam = db.teams[player.teamId];

        oldTeam.players = oldTeam.players.filter(
          (id) => id !== player.id
        );

        const oldRole = interaction.guild.roles.cache.get(
          oldTeam.roleId
        );

        if (oldRole) {
          await interaction.member.roles
            .remove(oldRole)
            .catch(() => {});
        }
      }

      team.budget -= kap.fee;

      player.budget += kap.fee;
      player.teamId = team.id;

      if (!team.players.includes(player.id)) {
        team.players.push(player.id);
      }

      const newRole = interaction.guild.roles.cache.get(
        team.roleId
      );

      if (newRole) {
        await interaction.member
          .roles.add(newRole)
          .catch(() => {});
      }

      kap.status = "accepted";
      kap.completedAt = Date.now();

      db.transfers.push({
        kapId,
        playerId: kap.playerId,
        teamId: kap.teamId,
        fee: kap.fee,
        date: Date.now(),
      });

      saveData();

      return interaction.update({
        content:
          `✅ Transfer tamamlandı!\n\n` +
          `👤 Oyuncu: <@${kap.playerId}>\n` +
          `🏟️ Yeni takım: **${team.name}**\n` +
          `💰 Bonservis: **${formatMoney(kap.fee)}**`,
        embeds: [],
        components: [],
      });
    }

    /* =====================================================
       ÇEKİLİŞ KATIL
    ===================================================== */

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("giveaway_join_")
    ) {
      const id =
        interaction.customId.replace(
          "giveaway_join_",
          ""
        );

      const giveaway = db.giveaways[id];

      if (!giveaway || giveaway.ended) {
        return interaction.reply({
          content: "❌ Bu çekiliş sona ermiş.",
          ephemeral: true,
        });
      }

      if (
        giveaway.participants.includes(
          interaction.user.id
        )
      ) {
        return interaction.reply({
          content:
            "❌ Çekilişe zaten katıldın.",
          ephemeral: true,
        });
      }

      giveaway.participants.push(
        interaction.user.id
      );

      saveData();

      return interaction.reply({
        content: "🎁 Çekilişe katıldın!",
        ephemeral: true,
      });
    }
  } catch (err) {
    console.error("Interaction hatası:", err);

    if (!interaction.replied && !interaction.deferred) {
      await interaction
        .reply({
          content: "❌ Bir hata oluştu.",
          ephemeral: true,
        })
        .catch(() => {});
    }
  }
});

/* =========================================================
   ÇEKİLİŞ BİTİR
========================================================= */

async function finishGiveaway(id) {
  const giveaway = db.giveaways[id];

  if (!giveaway || giveaway.ended) return;

  giveaway.ended = true;

  const channel = client.channels.cache.get(
    giveaway.channelId
  );

  if (!channel) return;

  if (!giveaway.participants.length) {
    await channel.send(
      "🎁 Çekiliş sona erdi ancak katılan olmadı."
    );

    saveData();
    return;
  }

  const winnerId =
    giveaway.participants[
      Math.floor(
        Math.random() *
          giveaway.participants.length
      )
    ];

  const player = getPlayer(winnerId);

  player.budget += giveaway.prize;

  saveData();

  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("🎉 Çekiliş Sonucu")
        .setDescription(
          `🏆 Kazanan: <@${winnerId}>\n\n` +
            `💰 Ödül: **${formatMoney(
              giveaway.prize
            )}**`
        )
        .setTimestamp(),
    ],
  });
}

/* =========================================================
   HATA YAKALAMA
========================================================= */

process.on("unhandledRejection", (error) => {
  console.error("Unhandled Rejection:", error);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

/* =========================================================
   LOGIN — DOSYANIN EN SONU
========================================================= */

client.login(TOKEN);
