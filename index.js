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

const fs = require("fs");
const path = require("path");

// =====================================================
// TOKEN
// Railway Variables -> TOKEN
// =====================================================

const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.error("❌ TOKEN bulunamadı!");
  process.exit(1);
}

// =====================================================
// ROLLER
// =====================================================

const ROLES = {
  YONETICI: "1544449436011339806",
  KAYIT: "1544452022764568656",
  DEGER: "1544451743746891806"
};

// =====================================================
// VERİ DOSYASI
// =====================================================

const DATA_FILE = path.join(__dirname, "data.json");

const DEFAULT_DB = {
  users: {},
  teams: {},
  companies: {},
  sponsors: {},
  transfers: {},
  giveaways: {},
  tickets: {},
  ads: {}
};

let db = DEFAULT_DB;

if (fs.existsSync(DATA_FILE)) {
  try {
    const oldData = JSON.parse(
      fs.readFileSync(DATA_FILE, "utf8")
    );

    db = {
      ...DEFAULT_DB,
      ...oldData
    };
  } catch {
    db = DEFAULT_DB;
  }
}

function save() {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(db, null, 2)
  );
}

// =====================================================
// CLIENT
// =====================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [
    Partials.Channel,
    Partials.Message
  ]
});

// =====================================================
// PARA
// =====================================================

function parseMoney(text) {
  if (!text) return 0;

  let value = String(text)
    .toLowerCase()
    .replace(/€/g, "")
    .replace(/\s/g, "")
    .replace(",", ".");

  if (value.endsWith("m")) {
    return Math.round(parseFloat(value) * 1000000);
  }

  if (value.endsWith("k")) {
    return Math.round(parseFloat(value) * 1000);
  }

  if (/^\d+$/.test(value)) {
    return Number(value);
  }

  return Number(value.replace(/\./g, "")) || 0;
}

function money(value) {
  value = Math.max(
    0,
    Math.round(Number(value) || 0)
  );

  if (value >= 1000000) {
    const m = value / 1000000;
    return `${Number(m.toFixed(2))}M€`;
  }

  if (value >= 1000) {
    const k = value / 1000;
    return `${Number(k.toFixed(2))}K€`;
  }

  return `${value}€`;
}

// =====================================================
// KULLANICI
// =====================================================

function getUser(id) {
  if (!db.users[id]) {
    db.users[id] = {
      registered: false,
      value: 0,
      training: 0,
      goals: 0,
      team: null,
      position: null
    };
  }

  return db.users[id];
}

// =====================================================
// YETKİ
// =====================================================

function isAdmin(member) {
  return (
    member.permissions.has(
      PermissionsBitField.Flags.Administrator
    ) ||
    member.roles.cache.has(ROLES.YONETICI)
  );
}

function hasRole(member, roleId) {
  return (
    isAdmin(member) ||
    member.roles.cache.has(roleId)
  );
}

// =====================================================
// ROL OLUŞTUR
// =====================================================

async function getOrCreateRole(
  guild,
  name,
  color,
  hoist = true
) {
  let role = guild.roles.cache.find(
    r => r.name === name
  );

  if (!role) {
    role = await guild.roles.create({
      name,
      color,
      hoist,
      mentionable: true,
      reason: "Legendary League sistemi"
    });
  } else {
    await role.edit({
      color,
      hoist,
      mentionable: true
    }).catch(() => {});
  }

  return role;
}

// =====================================================
// TEMEL ROLLER
// =====================================================

async function setupRoles(guild) {
  await getOrCreateRole(
    guild,
    "⚽ FUTBOLCU",
    "#3498DB",
    true
  );

  await getOrCreateRole(
    guild,
    "🎩 TEKNİK DİREKTÖR",
    "#9B59B6",
    true
  );

  await getOrCreateRole(
    guild,
    "🏢 ŞİRKET",
    "#F1C40F",
    true
  );

  await getOrCreateRole(
    guild,
    "💼 SPONSOR",
    "#2ECC71",
    true
  );
}

// =====================================================
// NPC ŞİRKETLER
// =====================================================

const NPC_COMPANIES = [
  "Emirates",
  "Nike",
  "Adidas",
  "Puma",
  "Qatar Airways",
  "Red Bull",
  "Pepsi",
  "Coca-Cola"
];

async function setupCompanies(guild) {
  for (const company of NPC_COMPANIES) {
    const key = company.toLowerCase();

    if (!db.companies[key]) {
      const role = await getOrCreateRole(
        guild,
        `🏢 ${company}`,
        "#F1C40F",
        true
      );

      db.companies[key] = {
        name: company,
        npc: true,
        roleId: role.id,
        budget: 50000000,
        sponsors: []
      };
    }
  }

  save();
}

// =====================================================
// READY
// =====================================================

client.once("ready", async () => {
  console.log("================================");
  console.log(`✅ ${client.user.tag} aktif!`);
  console.log("================================");

  for (const guild of client.guilds.cache.values()) {
    try {
      await setupRoles(guild);
      await setupCompanies(guild);
    } catch (err) {
      console.log(
        "Kurulum hatası:",
        err.message
      );
    }
  }

  client.user.setPresence({
    activities: [
      {
        name: "⚽ Legendary League",
        type: 3
      }
    ],
    status: "online"
  });
});

// =====================================================
// ÜYE GİRİŞ
// =====================================================

client.on("guildMemberAdd", async member => {
  const channel =
    member.guild.channels.cache.find(
      c =>
        c.type === ChannelType.GuildText &&
        (
          c.name.toLowerCase() === "kayıt" ||
          c.name.toLowerCase() === "kayit"
        )
    );

  const kayitsiz =
    member.guild.roles.cache.find(
      r =>
        r.name.toLowerCase() ===
        "kayıtsız"
    );

  if (kayitsiz) {
    await member.roles.add(kayitsiz)
      .catch(() => {});
  }

  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle("👋 Yeni Oyuncu Geldi!")
    .setDescription(
      `${member} sunucuya katıldı.\n\n` +
      `Kayıt işlemi için aşağıdaki butonları kullanın.`
    )
    .setColor("#3498DB")
    .setTimestamp();

  const row =
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(
          `register_player_${member.id}`
        )
        .setLabel("⚽ Futbolcu")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId(
          `register_manager_${member.id}`
        )
        .setLabel("🎩 Teknik Direktör")
        .setStyle(ButtonStyle.Secondary)
    );

  await channel.send({
    content: `<@&${ROLES.KAYIT}>`,
    embeds: [embed],
    components: [row]
  }).catch(() => {});
});

// =====================================================
// BUTON SİSTEMLERİ
// =====================================================

client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;

  // ===================================================
  // FUTBOLCU KAYIT
  // ===================================================

  if (
    interaction.customId.startsWith(
      "register_player_"
    )
  ) {
    if (
      !hasRole(
        interaction.member,
        ROLES.KAYIT
      )
    ) {
      return interaction.reply({
        content:
          "❌ Sadece Kayıt Yetkilisi kullanabilir.",
        ephemeral: true
      });
    }

    const id =
      interaction.customId.split("_")[2];

    const member =
      await interaction.guild.members
        .fetch(id)
        .catch(() => null);

    if (!member) {
      return interaction.reply({
        content: "❌ Oyuncu bulunamadı.",
        ephemeral: true
      });
    }

    const role =
      interaction.guild.roles.cache.find(
        r => r.name === "⚽ FUTBOLCU"
      );

    const kayitsiz =
      interaction.guild.roles.cache.find(
        r =>
          r.name.toLowerCase() ===
          "kayıtsız"
      );

    if (role)
      await member.roles.add(role)
        .catch(() => {});

    if (kayitsiz)
      await member.roles.remove(kayitsiz)
        .catch(() => {});

    const user = getUser(member.id);

    user.registered = true;
    user.position = "Futbolcu";

    save();

    await member.setNickname(
      `${member.user.username} | ⚽ | 0€`
    ).catch(() => {});

    return interaction.reply({
      content:
        `✅ ${member} **Futbolcu** olarak kayıt edildi.\n` +
        `👮 Kayıt Yetkilisi: ${interaction.user}`,
      ephemeral: false
    });
  }

  // ===================================================
  // TEKNİK DİREKTÖR KAYIT
  // ===================================================

  if (
    interaction.customId.startsWith(
      "register_manager_"
    )
  ) {
    if (
      !hasRole(
        interaction.member,
        ROLES.KAYIT
      )
    ) {
      return interaction.reply({
        content:
          "❌ Sadece Kayıt Yetkilisi kullanabilir.",
        ephemeral: true
      });
    }

    const id =
      interaction.customId.split("_")[2];

    const member =
      await interaction.guild.members
        .fetch(id)
        .catch(() => null);

    if (!member) {
      return interaction.reply({
        content: "❌ Oyuncu bulunamadı.",
        ephemeral: true
      });
    }

    const role =
      interaction.guild.roles.cache.find(
        r =>
          r.name ===
          "🎩 TEKNİK DİREKTÖR"
      );

    const kayitsiz =
      interaction.guild.roles.cache.find(
        r =>
          r.name.toLowerCase() ===
          "kayıtsız"
      );

    if (role)
      await member.roles.add(role)
        .catch(() => {});

    if (kayitsiz)
      await member.roles.remove(kayitsiz)
        .catch(() => {});

    const user = getUser(member.id);

    user.registered = true;
    user.position = "Teknik Direktör";

    save();

    return interaction.reply({
      content:
        `✅ ${member} **Teknik Direktör** olarak kayıt edildi.\n` +
        `👮 Kayıt Yetkilisi: ${interaction.user}`,
      ephemeral: false
    });
  }

  // ===================================================
  // KAP KABUL
  // ===================================================

  if (
    interaction.customId.startsWith(
      "kap_accept_"
    )
  ) {
    const transferId =
      interaction.customId.replace(
        "kap_accept_",
        ""
      );

    const transfer =
      db.transfers[transferId];

    if (!transfer) {
      return interaction.reply({
        content:
          "❌ Bu transfer teklifi artık geçerli değil.",
        ephemeral: true
      });
    }

    const isPlayer =
      interaction.user.id ===
      transfer.playerId;

    const isSellerManager =
      interaction.user.id ===
      transfer.sellerManager;

    const isBuyerManager =
      interaction.user.id ===
      transfer.buyerManager;

    if (
      !isPlayer &&
      !isSellerManager &&
      !isBuyerManager
    ) {
      return interaction.reply({
        content:
          "❌ Bu transferde onay yetkin yok.",
        ephemeral: true
      });
    }

    if (isPlayer)
      transfer.playerAccepted = true;

    if (isSellerManager)
      transfer.sellerAccepted = true;

    if (isBuyerManager)
      transfer.buyerAccepted = true;

    save();

    // ---------------------------------------------------
    // GEREKLİ ONAYLAR
    // ---------------------------------------------------

    const buyerTeam =
      db.teams[transfer.buyerTeam];

    const sellerTeam =
      transfer.sellerTeam
        ? db.teams[transfer.sellerTeam]
        : null;

    const requiredPlayer = true;
    const requiredSeller =
      sellerTeam !== null;

    const allAccepted =
      transfer.playerAccepted &&
      transfer.buyerAccepted &&
      (
        !requiredSeller ||
        transfer.sellerAccepted
      );

    if (!allAccepted) {
      return interaction.reply({
        content:
          "✅ Onayın kaydedildi. Diğer gerekli tarafların onayı bekleniyor.",
        ephemeral: true
      });
    }

    // ---------------------------------------------------
    // BÜTÇE KONTROLÜ
    // ---------------------------------------------------

    if (
      !buyerTeam ||
      buyerTeam.budget <
        transfer.amount
    ) {
      return interaction.reply({
        content:
          "❌ Alıcı takımın bütçesi artık yeterli değil.",
        ephemeral: true
      });
    }

    // ---------------------------------------------------
    // PARA
    // ---------------------------------------------------

    buyerTeam.budget -=
      transfer.amount;

    if (sellerTeam) {
      sellerTeam.budget +=
        transfer.amount;
    }

    // ---------------------------------------------------
    // OYUNCU
    // ---------------------------------------------------

    const player =
      await interaction.guild.members
        .fetch(transfer.playerId)
        .catch(() => null);

    if (player) {
      if (sellerTeam) {
        const oldRole =
          interaction.guild.roles.cache.get(
            sellerTeam.roleId
          );

        if (oldRole) {
          await player.roles
            .remove(oldRole)
            .catch(() => {});
        }

        sellerTeam.players =
          sellerTeam.players.filter(
            id =>
              id !== transfer.playerId
          );
      }

      const newRole =
        interaction.guild.roles.cache.get(
          buyerTeam.roleId
        );

      if (newRole) {
        await player.roles
          .add(newRole)
          .catch(() => {});
      }

      if (!buyerTeam.players.includes(
        transfer.playerId
      )) {
        buyerTeam.players.push(
          transfer.playerId
        );
      }

      const user =
        getUser(transfer.playerId);

      user.team =
        buyerTeam.name;
    }

    transfer.completed = true;

    save();

    // ---------------------------------------------------
    // KAP DUYURUSU
    // ---------------------------------------------------

    const embed =
      new EmbedBuilder()
        .setTitle(
          "📄 KAP — TRANSFER RESMİLEŞTİ"
        )
        .setColor("#2ECC71")
        .setDescription(
          `Transfer başarıyla tamamlandı.`
        )
        .addFields(
          {
            name: "👤 Oyuncu",
            value:
              `<@${transfer.playerId}>`
          },
          {
            name: "🏟️ Yeni Takım",
            value:
              buyerTeam.name
          },
          {
            name: "💰 Transfer Bedeli",
            value:
              money(transfer.amount)
          }
        )
        .setTimestamp();

    await interaction.channel
      .send({
        embeds: [embed]
      })
      .catch(() => {});

    return interaction.reply({
      content:
        "✅ Gerekli tüm onaylar tamamlandı. Transfer gerçekleşti!",
      ephemeral: true
    });
  }

  // ===================================================
  // KAP RED
  // ===================================================

  if (
    interaction.customId.startsWith(
      "kap_reject_"
    )
  ) {
    const transferId =
      interaction.customId.replace(
        "kap_reject_",
        ""
      );

    const transfer =
      db.transfers[transferId];

    if (!transfer) {
      return interaction.reply({
        content:
          "❌ Transfer bulunamadı.",
        ephemeral: true
      });
    }

    const allowed =
      [
        transfer.playerId,
        transfer.sellerManager,
        transfer.buyerManager
      ].includes(
        interaction.user.id
      );

    if (!allowed) {
      return interaction.reply({
        content:
          "❌ Bu transferi reddetme yetkin yok.",
        ephemeral: true
      });
    }

    transfer.rejected = true;

    save();

    return interaction.update({
      content:
        "❌ **Transfer teklifi reddedildi.**",
      embeds: [],
      components: []
    });
  }

  // ===================================================
  // ÇEKİLİŞ
  // ===================================================

  if (
    interaction.customId.startsWith(
      "giveaway_join_"
    )
  ) {
    const giveawayId =
      interaction.customId.replace(
        "giveaway_join_",
        ""
      );

    const giveaway =
      db.giveaways[giveawayId];

    if (!giveaway) {
      return interaction.reply({
        content:
          "❌ Çekiliş bitmiş.",
        ephemeral: true
      });
    }

    if (
      giveaway.participants.includes(
        interaction.user.id
      )
    ) {
      return interaction.reply({
        content:
          "❌ Zaten katıldın.",
        ephemeral: true
      });
    }

    giveaway.participants.push(
      interaction.user.id
    );

    save();

    return interaction.reply({
      content:
        "🎉 Çekilişe katıldın!",
      ephemeral: true
    });
  }
});

// =====================================================
// MESAJ KOMUTLARI
// =====================================================

client.on("messageCreate", async message => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const parts =
    message.content.trim()
      .split(/\s+/);

  const rawCommand =
    parts.shift();

  if (!rawCommand) return;
  if (!rawCommand.startsWith(".")) return;

  const command =
    rawCommand
      .slice(1)
      .toLowerCase();

  const args = parts;

  // ===================================================
  // YARDIM
  // ===================================================

  if (
    command === "yardım" ||
    command === "help"
  ) {
    const embed =
      new EmbedBuilder()
        .setTitle(
          "⚽ LEGENDARY LEAGUE BOT"
        )
        .setColor("#3498DB")
        .setDescription(
          [
            "**👤 KAYIT**",
            "`.k @oyuncu isim`",
            "",
            "**💰 DEĞER**",
            "`.dver @oyuncu 5M`",
            "`.değer @oyuncu`",
            "",
            "**🏋️ GELİŞİM**",
            "`.ant` / `.antrenman`",
            "`.pen` / `.penaltı`",
            "",
            "**🏟️ TAKIM**",
            "`.takımkur takımadı`",
            "`.kadro @oyuncu`",
            "`.takım`",
            "",
            "**⚔️ MAÇ**",
            "`.maç @takım1 @takım2`",
            "",
            "**📄 TRANSFER**",
            "`.kap @oyuncu 15M`",
            "`.transfer @oyuncu 15M`",
            "",
            "**💼 SPONSOR**",
            "`.sponsorlar`",
            "`.sponsorbaşvur takım şirket miktar`",
            "",
            "**🎁 ÇEKİLİŞ**",
            "`.çekiliş 5M€ 5m`",
            "",
            "**📢 REKLAM**",
            "`.reklam`",
            "",
            "**🛡️ MODERASYON**",
            "`.kick @üye`",
            "`.ban @üye`",
            "`.mute @üye`",
            "`.unmute @üye`",
            "`.sil 100`",
            "",
            "**🔒 KANAL**",
            "`.kilit`",
            "`.aç`",
            "",
            "**🎫 TICKET**",
            "`.ticket`",
            "",
            "**📨 DM**",
            "`.dm all mesaj`",
            "",
            "**⚙️ YÖNETİM**",
            "`.embed başlık | açıklama`",
            "`.sunucuprofil isim`"
          ].join("\n")
        );

    return message.reply({
      embeds: [embed]
    });
  }

  // ===================================================
  // KAYIT KOMUTU
  // ===================================================

  if (command === "k") {
    if (
      !hasRole(
        message.member,
        ROLES.KAYIT
      )
    ) {
      return message.reply(
        "❌ Kayıt Yetkilisi değilsin."
      );
    }

    const member =
      message.mentions.members.first();

    const name =
      args.slice(1).join(" ");

    if (!member || !name) {
      return message.reply(
        "Kullanım: `.k @oyuncu isim`"
      );
    }

    const role =
      message.guild.roles.cache.find(
        r => r.name === "⚽ FUTBOLCU"
      );

    const kayitsiz =
      message.guild.roles.cache.find(
        r =>
          r.name.toLowerCase() ===
          "kayıtsız"
      );

    if (role)
      await member.roles.add(role)
        .catch(() => {});

    if (kayitsiz)
      await member.roles.remove(kayitsiz)
        .catch(() => {});

    const user =
      getUser(member.id);

    user.registered = true;
    user.position = "Futbolcu";

    save();

    await member.setNickname(
      `${name} | ⚽ | ${money(user.value)}`
    ).catch(() => {});

    const embed =
      new EmbedBuilder()
        .setTitle("✅ KAYIT TAMAMLANDI")
        .setColor("#2ECC71")
        .setDescription(
          `${member} başarıyla kayıt edildi.`
        )
        .addFields(
          {
            name: "👤 Oyuncu",
            value: name
          },
          {
            name: "⚽ Pozisyon",
            value: "Futbolcu"
          },
          {
            name: "👮 Yetkili",
            value:
              `${message.author}`
          }
        )
        .setTimestamp();

    return message.channel.send({
      embeds: [embed]
    });
  }

  // ===================================================
  // DEĞER VER
  // ===================================================

  if (command === "dver") {
    if (
      !hasRole(
        message.member,
        ROLES.DEGER
      )
    ) {
      return message.reply(
        "❌ Değer Yetkilisi değilsin."
      );
    }

    const member =
      message.mentions.members.first();

    const amount =
      args[1];

    if (!member || !amount) {
      return message.reply(
        "Kullanım: `.dver @oyuncu 5M`"
      );
    }

    const add =
      parseMoney(amount);

    if (add <= 0) {
      return message.reply(
        "❌ Geçerli bir değer gir."
      );
    }

    const user =
      getUser(member.id);

    user.value += add;

    save();

    const old =
      member.nickname ||
      member.user.username;

    let base =
      old.split("|")[0].trim();

    await member.setNickname(
      `${base} | ${money(user.value)}`
    ).catch(() => {});

    return message.reply(
      `✅ ${member} değerine **${money(add)}** eklendi.\n` +
      `💰 Yeni değer: **${money(user.value)}**`
    );
  }

  // ===================================================
  // DEĞER GÖSTER
  // ===================================================

  if (
    command === "değer" ||
    command === "deger"
  ) {
    const member =
      message.mentions.members.first() ||
      message.member;

    const user =
      getUser(member.id);

    return message.reply(
      `💰 ${member} oyuncusunun değeri: **${money(user.value)}**`
    );
  }

  // ===================================================
  // ANTRENMAN
  // ===================================================

  if (
    command === "ant" ||
    command === "antrenman"
  ) {
    const user =
      getUser(message.author.id);

    user.training++;

    let reward = 0;

    if (user.training >= 10) {
      user.training = 0;

      reward = 300000;

      // OTOMATİK DEĞER
      user.value += reward;
    }

    save();

    if (reward > 0) {
      const member =
        message.member;

      const old =
        member.nickname ||
        member.user.username;

      const base =
        old.split("|")[0].trim();

      await member.setNickname(
        `${base} | ${money(user.value)}`
      ).catch(() => {});

      return message.reply(
        `🏋️ **10/10 ANTRENMAN TAMAMLANDI!**\n\n` +
        `🎁 Otomatik ödül: **+3M€**\n` +
        `💰 Yeni değer: **${money(user.value)}**`
      );
    }

    return message.reply(
      `🏋️ Antrenman tamamlandı!\n` +
      `📊 İlerleme: **${user.training}/10**`
    );
  }

  // ===================================================
  // PENALTI
  // ===================================================

  if (
    command === "pen" ||
    command === "penaltı" ||
    command === "penalti"
  ) {
    const user =
      getUser(message.author.id);

    const goal =
      Math.random() < 0.5;

    if (!goal) {
      return message.reply(
        "🥅 ❌ PENALTI KAÇTI!"
      );
    }

    // OTOMATİK +2M
    user.goals++;
    user.value += 2000000;

    save();

    const old =
      message.member.nickname ||
      message.author.username;

    const base =
      old.split("|")[0].trim();

    await message.member
      .setNickname(
        `${base} | ${money(user.value)}`
      )
      .catch(() => {});

    return message.reply(
      `🥅 ⚽ **GOOOOOL!**\n\n` +
      `💰 Otomatik değer ödülü: **+2M€**\n` +
      `📊 Yeni değer: **${money(user.value)}**`
    );
  }

  // ===================================================
  // TAKIM KUR
  // ===================================================

  if (
    command === "takımkur" ||
    command === "takimkur"
  ) {
    const managerRole =
      message.guild.roles.cache.find(
        r =>
          r.name ===
          "🎩 TEKNİK DİREKTÖR"
      );

    if (
      !managerRole ||
      !message.member.roles.cache.has(
        managerRole.id
      )
    ) {
      return message.reply(
        "❌ Sadece Teknik Direktör takım kurabilir."
      );
    }

    const teamName =
      args.join(" ");

    if (!teamName) {
      return message.reply(
        "Kullanım: `.takımkur Galatasaray`"
      );
    }

    const key =
      teamName.toLowerCase();

    if (db.teams[key]) {
      return message.reply(
        "❌ Bu takım zaten mevcut."
      );
    }

    const already =
      Object.values(db.teams)
        .find(
          t =>
            t.owner ===
            message.author.id
        );

    if (already) {
      return message.reply(
        `❌ Zaten **${already.name}** takımına sahipsin.`
      );
    }

    const color =
      Math.floor(
        Math.random() * 16777215
      );

    const role =
      await message.guild.roles.create({
        name: `🏟️ ${teamName}`,
        color,
        hoist: true,
        mentionable: true,
        reason:
          "Legendary League takım sistemi"
      });

    await message.member.roles
      .add(managerRole)
      .catch(() => {});

    await message.member.roles
      .add(role)
      .catch(() => {});

    db.teams[key] = {
      name: teamName,
      roleId: role.id,
      owner: message.author.id,
      budget: 0,
      players: []
    };

    save();

    return message.reply(
      `🏟️ **${teamName}** oluşturuldu!\n` +
      `🎩 Teknik Direktör: ${message.author}\n` +
      `🎨 Takım rolü: ${role}`
    );
  }

  // ===================================================
  // KADRO
  // ===================================================

  if (command === "kadro") {
    const member =
      message.mentions.members.first();

    if (!member) {
      return message.reply(
        "Kullanım: `.kadro @oyuncu`"
      );
    }

    const team =
      Object.values(db.teams)
        .find(
          t =>
            t.owner ===
            message.author.id
        );

    if (!team) {
      return message.reply(
        "❌ Bir takımın Teknik Direktörü değilsin."
      );
    }

    if (
      !team.players.includes(
        member.id
      )
    ) {
      team.players.push(
        member.id
      );
    }

    const role =
      message.guild.roles.cache.get(
        team.roleId
      );

    if (role) {
      await member.roles
        .add(role)
        .catch(() => {});
    }

    const user =
      getUser(member.id);

    user.team =
      team.name;

    save();

    return message.reply(
      `✅ ${member}, **${team.name}** kadrosuna eklendi.`
    );
  }

  // ===================================================
  // TAKIM BİLGİ
  // ===================================================

  if (
    command === "takım" ||
    command === "takim"
  ) {
    const team =
      Object.values(db.teams)
        .find(
          t =>
            t.owner ===
              message.author.id ||
            t.players.includes(
              message.author.id
            )
        );

    if (!team) {
      return message.reply(
        "❌ Bir takımda değilsin."
      );
    }

    const players =
      team.players.length
        ? team.players
            .map(
              id =>
                `<@${id}>`
            )
            .join("\n")
        : "Kadro boş.";

    const embed =
      new EmbedBuilder()
        .setTitle(
          `🏟️ ${team.name}`
        )
        .setColor("#3498DB")
        .addFields(
          {
            name:
              "🎩 Teknik Direktör",
            value:
              `<@${team.owner}>`
          },
          {
            name: "💰 Bütçe",
            value:
              money(team.budget)
          },
          {
            name: "👥 Kadro",
            value:
              players
          }
        );

    return message.reply({
      embeds: [embed]
    });
  }

  // ===================================================
  // MAÇ
  // ===================================================

  if (
    command === "maç" ||
    command === "mac"
  ) {
    const role1 =
      message.mentions.roles.first();

    const role2 =
      message.mentions.roles.at(1);

    if (!role1 || !role2) {
      return message.reply(
        "Kullanım: `.maç @takım1 @takım2`"
      );
    }

    const team1 =
      Object.values(db.teams)
        .find(
          t =>
            t.roleId ===
            role1.id
        );

    const team2 =
      Object.values(db.teams)
        .find(
          t =>
            t.roleId ===
            role2.id
        );

    if (!team1 || !team2) {
      return message.reply(
        "❌ Takımlardan biri bulunamadı."
      );
    }

    await message.channel.send(
      `⚽ **MAÇ BAŞLADI!**\n\n` +
      `🏟️ **${team1.name}** vs **${team2.name}**`
    );

    const events = [
      "⚡ Orta saha mücadelesi!",
      "🎯 Tehlikeli şut!",
      "🧤 Kaleci kurtardı!",
      "🔥 Baskı artıyor!",
      "⚽ GOOOOOOL!",
      "🚨 Ceza sahasında tehlike!",
      "🎯 Direkten döndü!",
      "🧤 Muhteşem kurtarış!"
    ];

    for (let i = 0; i < 5; i++) {
      await new Promise(
        resolve =>
          setTimeout(resolve, 1000)
      );

      await message.channel.send(
        events[
          Math.floor(
            Math.random() *
            events.length
          )
        ]
      );
    }

    const score1 =
      Math.floor(
        Math.random() * 6
      );

    const score2 =
      Math.floor(
        Math.random() * 6
      );

    return message.channel.send(
      `🏁 **MAÇ SONA ERDİ!**\n\n` +
      `🏟️ **${team1.name}** ` +
      `**${score1} - ${score2}** ` +
      `**${team2.name}**`
    );
  }

  // ===================================================
  // KAP
  // ===================================================

  if (command === "kap") {
    const player =
      message.mentions.members.first();

    const amount =
      parseMoney(args[1]);

    if (!player || amount <= 0) {
      return message.reply(
        "Kullanım: `.kap @oyuncu 15M`"
      );
    }

    const buyerTeam =
      Object.values(db.teams)
        .find(
          t =>
            t.owner ===
            message.author.id
        );

    if (!buyerTeam) {
      return message.reply(
        "❌ Bir takımın Teknik Direktörü olmalısın."
      );
    }

    if (
      buyerTeam.budget <
      amount
    ) {
      return message.reply(
        "❌ Takım bütçen yetersiz."
      );
    }

    const playerData =
      getUser(player.id);

    if (
      playerData.team &&
      playerData.team.toLowerCase() ===
        buyerTeam.name.toLowerCase()
    ) {
      return message.reply(
        "❌ Oyuncu zaten senin takımında."
      );
    }

    const sellerTeam =
      playerData.team
        ? Object.values(db.teams)
            .find(
              t =>
                t.name.toLowerCase() ===
                playerData.team.toLowerCase()
            )
        : null;

    const id =
      `${Date.now()}_${message.author.id}_${player.id}`;

    db.transfers[id] = {
      id,
      playerId: player.id,
      buyerTeam:
        buyerTeam.name.toLowerCase(),
      sellerTeam:
        sellerTeam
          ? sellerTeam.name.toLowerCase()
          : null,
      buyerManager:
        buyerTeam.owner,
      sellerManager:
        sellerTeam
          ? sellerTeam.owner
          : null,
      amount,
      playerAccepted: false,
      buyerAccepted: false,
      sellerAccepted:
        sellerTeam ? false : true,
      rejected: false,
      completed: false
    };

    save();

    const embed =
      new EmbedBuilder()
        .setTitle(
          "📄 KAP — TRANSFER TEKLİFİ"
        )
        .setColor("#F1C40F")
        .setDescription(
          `**${buyerTeam.name}** oyuncuya resmi transfer teklifi gönderdi.`
        )
        .addFields(
          {
            name: "👤 Oyuncu",
            value:
              `${player}`
          },
          {
            name: "🏟️ Teklif Yapan",
            value:
              buyerTeam.name
          },
          {
            name: "💰 Teklif",
            value:
              money(amount)
          },
          {
            name:
              "🎩 Oyuncunun Teknik Direktörü",
            value:
              sellerTeam
                ? `<@${sellerTeam.owner}>`
                : "Takımı yok"
          }
        )
        .setFooter({
          text:
            "Transfer için gerekli tarafların onayı gerekir."
        })
        .setTimestamp();

    const row =
      new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(
              `kap_accept_${id}`
            )
            .setLabel(
              "✅ Kabul Et"
            )
            .setStyle(
              ButtonStyle.Success
            ),

          new ButtonBuilder()
            .setCustomId(
              `kap_reject_${id}`
            )
            .setLabel(
              "❌ Reddet"
            )
            .setStyle(
              ButtonStyle.Danger
            )
        );

    return message.channel.send({
      embeds: [embed],
      components: [row]
    });
  }

  // ===================================================
  // SPONSOR LİSTESİ
  // ===================================================

  if (
    command === "sponsorlar" ||
    command === "sponsor"
  ) {
    const companies =
      Object.values(
        db.companies
      );

    const text =
      companies.map(
        company =>
          `🏢 **${company.name}** — ` +
          `💰 ${money(company.budget)}`
      ).join("\n");

    const embed =
      new EmbedBuilder()
        .setTitle(
          "💼 NPC SPONSOR ŞİRKETLERİ"
        )
        .setColor("#2ECC71")
        .setDescription(
          text ||
          "Sponsor şirket bulunamadı."
        );

    return message.reply({
      embeds: [embed]
    });
  }

  // ===================================================
  // SPONSOR BAŞVURU
  // ===================================================

  if (
    command ===
      "sponsorbaşvur" ||
    command ===
      "sponsorbasvur"
  ) {
    const teamName =
      args[0];

    const companyName =
      args[1];

    const amount =
      parseMoney(args[2]);

    if (
      !teamName ||
      !companyName ||
      amount <= 0
    ) {
      return message.reply(
        "Kullanım: `.sponsorbaşvur takım şirket 10M`"
      );
    }

    const team =
      db.teams[
        teamName.toLowerCase()
      ];

    const company =
      db.companies[
        companyName.toLowerCase()
      ];

    if (!team) {
      return message.reply(
        "❌ Takım bulunamadı."
      );
    }

    if (!company) {
      return message.reply(
        "❌ NPC şirket bulunamadı."
      );
    }

    if (
      team.owner !==
      message.author.id
    ) {
      return message.reply(
        "❌ Bu takımın Teknik Direktörü değilsin."
      );
    }

    if (
      company.budget <
      amount
    ) {
      return message.reply(
        "❌ NPC şirketin bütçesi bu sponsorluğu karşılamıyor."
      );
    }

    // NPC KARARI
    const accepted =
      Math.random() < 0.7;

    if (!accepted) {
      return message.reply(
        `🏢 **${company.name}** sponsor başvurunu reddetti.`
      );
    }

    company.budget -= amount;
    team.budget += amount;

    const key =
      `${company.name}_${team.name}`;

    db.sponsors[key] = {
      company:
        company.name,
      team:
        team.name,
      amount,
      date:
        Date.now()
    };

    company.sponsors.push(
      team.name
    );

    save();

    const sponsorRole =
      await getOrCreateRole(
        message.guild,
        `💼 SPONSOR • ${company.name}`,
        "#2ECC71",
        true
      );

    await message.member.roles
      .add(sponsorRole)
      .catch(() => {});

    return message.channel.send(
      `💼 **SPONSORLUK ONAYLANDI!**\n\n` +
      `🏢 Şirket: **${company.name}**\n` +
      `🏟️ Takım: **${team.name}**\n` +
      `💰 Sponsor bedeli: **${money(amount)}**`
    );
  }

  // ===================================================
  // ÇEKİLİŞ
  // ===================================================

  if (
    command === "çekiliş" ||
    command === "cekilis"
  ) {
    if (!isAdmin(message.member)) {
      return message.reply(
        "❌ Yetkin yok."
      );
    }

    const prize =
      args[0];

    const durationText =
      args[1];

    if (!prize || !durationText) {
      return message.reply(
        "Kullanım: `.çekiliş 5M€ 5m`"
      );
    }

    const match =
      durationText.match(
        /^(\d+)(s|m|h)$/i
      );

    if (!match) {
      return message.reply(
        "❌ Süre örneği: `30s`, `5m`, `2h`"
      );
    }

    const number =
      Number(match[1]);

    const unit =
      match[2].toLowerCase();

    let duration =
      number * 1000;

    if (unit === "m")
      duration =
        number * 60 * 1000;

    if (unit === "h")
      duration =
        number *
        60 *
        60 *
        1000;

    const id =
      `${Date.now()}_${message.author.id}`;

    db.giveaways[id] = {
      prize,
      participants: [],
      end:
        Date.now() +
        duration
    };

    save();

    const embed =
      new EmbedBuilder()
        .setTitle(
          "🎁 ÇEKİLİŞ"
        )
        .setColor("#9B59B6")
        .setDescription(
          `🎁 Ödül: **${prize}**\n\n` +
          `Katılmak için aşağıdaki butona bas!`
        )
        .setTimestamp();

    const row =
      new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(
              `giveaway_join_${id}`
            )
            .setLabel(
              "🎉 Katıl"
            )
            .setStyle(
              ButtonStyle.Primary
            )
        );

    const msg =
      await message.channel.send({
        embeds: [embed],
        components: [row]
      });

    setTimeout(async () => {
      const giveaway =
        db.giveaways[id];

      if (!giveaway)
        return;

      let result;

      if (
        giveaway.participants
          .length === 0
      ) {
        result =
          "❌ Katılan olmadı.";
      } else {
        const winner =
          giveaway.participants[
            Math.floor(
              Math.random() *
              giveaway.participants.length
            )
          ];

        result =
          `🏆 Kazanan: <@${winner}>`;
      }

      await message.channel.send(
        `🎁 **ÇEKİLİŞ SONA ERDİ!**\n` +
        `💰 Ödül: **${giveaway.prize}**\n` +
        result
      ).catch(() => {});

      delete db.giveaways[id];
      save();
    }, duration);

    return;
  }

  // ===================================================
  // REKLAM
  // ===================================================

  if (command === "reklam") {
    const embed =
      new EmbedBuilder()
        .setTitle(
          "📢 REKLAM PAKETLERİ"
        )
        .setColor("#E67E22")
        .setDescription(
          [
            "🥉 **Bronz** — 150K€",
            "🥈 **Gümüş** — 300K€",
            "🥇 **Altın** — 600K€",
            "💎 **Platin** — 1.2M€",
            "👑 **Legendary** — 2.4M€",
            "🌟 **Ultimate** — 4.8M€",
            "",
            "📣 `@everyone` — 100K€",
            "📢 `@here` — 50K€",
            "",
            "🔢 Maksimum hak: **5**"
          ].join("\n")
        );

    return message.reply({
      embeds: [embed]
    });
  }

  // ===================================================
  // DM ALL
  // ===================================================

  if (command === "dm") {
    if (!isAdmin(message.member)) {
      return message.reply(
        "❌ Yetkin yok."
      );
    }

    if (
      args[0]?.toLowerCase() !==
      "all"
    ) {
      return message.reply(
        "Kullanım: `.dm all mesaj`"
      );
    }

    const text =
      args.slice(1).join(" ");

    if (!text) {
      return message.reply(
        "❌ Mesaj boş."
      );
    }

    await message.guild.members
      .fetch();

    let sent = 0;

    for (
      const member
      of message.guild.members.cache.values()
    ) {
      if (member.user.bot)
        continue;

      await member.user
        .send(text)
        .then(() => sent++)
        .catch(() => {});

      await new Promise(
        resolve =>
          setTimeout(resolve, 150)
      );
    }

    return message.reply(
      `📨 DM sistemi tamamlandı.\n` +
      `✅ Gönderilen: **${sent}**`
    );
  }

  // ===================================================
  // KICK
  // ===================================================

  if (command === "kick") {
    if (!isAdmin(message.member))
      return message.reply(
        "❌ Yetkin yok."
      );

    const member =
      message.mentions.members.first();

    if (!member)
      return message.reply(
        "Kullanım: `.kick @üye`"
      );

    await member.kick(
      "Legendary League moderasyon"
    ).catch(() => {});

    return message.reply(
      `👢 ${member.user.tag} sunucudan atıldı.`
    );
  }

  // ===================================================
  // BAN
  // ===================================================

  if (command === "ban") {
    if (!isAdmin(message.member))
      return message.reply(
        "❌ Yetkin yok."
      );

    const member =
      message.mentions.members.first();

    if (!member)
      return message.reply(
        "Kullanım: `.ban @üye`"
      );

    await member.ban({
      reason:
        "Legendary League moderasyon"
    }).catch(() => {});

    return message.reply(
      `🔨 ${member.user.tag} yasaklandı.`
    );
  }

  // ===================================================
  // MUTE
  // ===================================================

  if (command === "mute") {
    if (!isAdmin(message.member))
      return message.reply(
        "❌ Yetkin yok."
      );

    const member =
      message.mentions.members.first();

    if (!member)
      return message.reply(
        "Kullanım: `.mute @üye`"
      );

    const role =
      await getOrCreateRole(
        message.guild,
        "🔇 Mute",
        "#7F8C8D",
        false
      );

    await member.roles
      .add(role)
      .catch(() => {});

    return message.reply(
      `🔇 ${member} susturuldu.`
    );
  }

  // ===================================================
  // UNMUTE
  // ===================================================

  if (
    command === "unmute"
  ) {
    if (!isAdmin(message.member))
      return message.reply(
        "❌ Yetkin yok."
      );

    const member =
      message.mentions.members.first();

    if (!member)
      return message.reply(
        "Kullanım: `.unmute @üye`"
      );

    const role =
      message.guild.roles.cache.find(
        r =>
          r.name ===
          "🔇 Mute"
      );

    if (role) {
      await member.roles
        .remove(role)
        .catch(() => {});
    }

    return message.reply(
      `🔊 ${member} susturması kaldırıldı.`
    );
  }

  // ===================================================
  // SİL
  // ===================================================

  if (command === "sil") {
    if (!isAdmin(message.member))
      return message.reply(
        "❌ Yetkin yok."
      );

    let amount =
      Number(args[0]);

    if (
      !amount ||
      amount < 1
    ) {
      return message.reply(
        "Kullanım: `.sil 100`"
      );
    }

    amount =
      Math.min(
        amount,
        1000
      );

    let deleted = 0;

    while (amount > 0) {
      const count =
        Math.min(
          amount,
          100
        );

      const messages =
        await message.channel
          .messages.fetch({
            limit: count
          });

      if (!messages.size)
        break;

      const deletable =
        messages.filter(
          m =>
            Date.now() -
              m.createdTimestamp <
            14 *
              24 *
              60 *
              60 *
              1000
        );

      if (!deletable.size)
        break;

      await message.channel
        .bulkDelete(
          deletable,
          true
        )
        .catch(() => {});

      deleted +=
        deletable.size;

      amount -=
        deletable.size;

      if (
        deletable.size <
        count
      ) break;
    }

    return message.channel.send(
      `🗑️ **${deleted}** mesaj silindi.`
    );
  }

  // ===================================================
  // KANAL KİLİT
  // ===================================================

  if (
    command === "kilit"
  ) {
    if (!isAdmin(message.member))
      return message.reply(
        "❌ Yetkin yok."
      );

    await message.channel
      .permissionOverwrites.edit(
        message.guild.roles.everyone,
        {
          SendMessages: false
        }
      );

    return message.channel.send(
      "🔒 Kanal kilitlendi."
    );
  }

  // ===================================================
  // KANAL AÇ
  // ===================================================

  if (
    command === "aç" ||
    command === "ac"
  ) {
    if (!isAdmin(message.member))
      return message.reply(
        "❌ Yetkin yok."
      );

    await message.channel
      .permissionOverwrites.edit(
        message.guild.roles.everyone,
        {
          SendMessages: null
        }
      );

    return message.channel.send(
      "🔓 Kanal açıldı."
    );
  }

  // ===================================================
  // EMBED
  // ===================================================

  if (
    command === "embed"
  ) {
    if (!isAdmin(message.member))
      return message.reply(
        "❌ Yetkin yok."
      );

    const text =
      args.join(" ");

    const split =
      text.split("|");

    if (
      !split[0] ||
      !split[1]
    ) {
      return message.reply(
        "Kullanım: `.embed Başlık | Açıklama`"
      );
    }

    const embed =
      new EmbedBuilder()
        .setTitle(
          split[0].trim()
        )
        .setDescription(
          split
            .slice(1)
            .join("|")
            .trim()
        )
        .setColor("#3498DB")
        .setTimestamp();

    return message.channel.send({
      embeds: [embed]
    });
  }

  // ===================================================
  // TICKET
  // ===================================================

  if (
    command === "ticket"
  ) {
    const channel =
      await message.guild.channels
        .create({
          name:
            `ticket-${message.author.username}`
              .toLowerCase()
              .replace(/[^a-z0-9-]/g, "")
              .slice(0, 80),
          type:
            ChannelType.GuildText,
          permissionOverwrites: [
            {
              id:
                message.guild.id,
              deny: [
                PermissionsBitField.Flags.ViewChannel
              ]
            },
            {
              id:
                message.author.id,
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory
              ]
            }
          ]
        })
        .catch(() => null);

    if (!channel) {
      return message.reply(
        "❌ Ticket oluşturulamadı."
      );
    }

    return message.reply(
      `🎫 Ticket oluşturuldu: ${channel}`
    );
  }

  // ===================================================
  // SUNUCU PROFİLİ
  // ===================================================

  if (
    command ===
    "sunucuprofil"
  ) {
    if (!isAdmin(message.member))
      return message.reply(
        "❌ Yetkin yok."
      );

    const newName =
      args.join(" ");

    if (!newName) {
      return message.reply(
        "Kullanım: `.sunucuprofil Legendary League`"
      );
    }

    await message.guild
      .setName(newName)
      .catch(() => {});

    return message.reply(
      `🖼️ Sunucu adı **${newName}** olarak güncellendi.`
    );
  }

  // ===================================================
  // İSTATİSTİK
  // ===================================================

  if (
    command ===
    "profil"
  ) {
    const user =
      getUser(
        message.author.id
      );

    const embed =
      new EmbedBuilder()
        .setTitle(
          `⚽ ${message.author.username}`
        )
        .setColor("#3498DB")
        .addFields(
          {
            name:
              "💰 Değer",
            value:
              money(user.value)
          },
          {
            name:
              "🏋️ Antrenman",
            value:
              `${user.training}/10`
          },
          {
            name:
              "🥅 Goller",
            value:
              String(user.goals)
          },
          {
            name:
              "🏟️ Takım",
            value:
              user.team ||
              "Takımsız"
          },
          {
            name:
              "👤 Rol",
            value:
              user.position ||
              "Kayıtsız"
          }
        )
        .setTimestamp();

    return message.reply({
      embeds: [embed]
    });
  }
});

// =====================================================
// HATA YAKALAMA
// =====================================================

process.on(
  "unhandledRejection",
  error => {
    console.error(
      "Unhandled Rejection:",
      error
    );
  }
);

process.on(
  "uncaughtException",
  error => {
    console.error(
      "Uncaught Exception:",
      error
    );
  }
);

// =====================================================
// LOGIN
// =====================================================

client.login(TOKEN);
