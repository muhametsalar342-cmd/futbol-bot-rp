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

// =========================
// AYARLAR
// =========================

const TOKEN = process.env.TOKEN;

const ROLES = {
  YONETICI: "1544449436011339806",
  KAYIT: "1544452022764568656",
  DEGER: "1544451743746891806"
};

const DATA_FILE = path.join(__dirname, "data.json");

if (!TOKEN) {
  console.error("TOKEN bulunamadı. Railway Variables kısmına TOKEN ekle.");
  process.exit(1);
}

// =========================
// VERİ
// =========================

let db = {
  users: {},
  teams: {},
  companies: {},
  sponsors: {},
  giveaways: {},
  matches: {},
  ads: {}
};

if (fs.existsSync(DATA_FILE)) {
  try {
    db = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    console.log("data.json okunamadı, yeni veri oluşturuluyor.");
  }
}

function save() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

// =========================
// CLIENT
// =========================

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

// =========================
// YARDIMCI
// =========================

function isAdmin(member) {
  return (
    member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    member.roles.cache.has(ROLES.YONETICI)
  );
}

function hasRole(member, roleId) {
  return member.roles.cache.has(roleId) || isAdmin(member);
}

function moneyToNumber(value) {
  if (!value) return 0;

  let v = String(value)
    .toLowerCase()
    .replace(/€/g, "")
    .replace(/\s/g, "")
    .replace(",", ".");

  if (v.endsWith("m")) {
    return Math.round(parseFloat(v) * 1000000);
  }

  if (v.endsWith("k")) {
    return Math.round(parseFloat(v) * 1000);
  }

  return Number(v.replace(/\./g, "")) || 0;
}

function formatMoney(number) {
  number = Math.max(0, Math.round(Number(number) || 0));

  if (number >= 1000000) {
    const m = number / 1000000;
    return `${Number(m.toFixed(2))}M€`;
  }

  if (number >= 1000) {
    const k = number / 1000;
    return `${Number(k.toFixed(2))}K€`;
  }

  return `${number}€`;
}

function getUserData(id) {
  if (!db.users[id]) {
    db.users[id] = {
      value: 0,
      training: 0,
      goals: 0,
      registered: false,
      team: null
    };
  }

  return db.users[id];
}

async function createRole(guild, name, color) {
  let role = guild.roles.cache.find(r => r.name === name);

  if (!role) {
    role = await guild.roles.create({
      name,
      color,
      hoist: true,
      mentionable: true,
      reason: "Legendary League sistemi"
    });
  } else {
    await role.edit({
      color,
      hoist: true,
      mentionable: true
    });
  }

  return role;
}

// =========================
// HAZIR ROLLER
// =========================

async function setupMainRoles(guild) {
  await createRole(guild, "⚽ FUTBOLCU", "#3498DB");
  await createRole(guild, "🎩 TEKNİK DİREKTÖR", "#9B59B6");
  await createRole(guild, "🏢 ŞİRKET", "#F1C40F");
  await createRole(guild, "💼 SPONSOR", "#2ECC71");
}

// =========================
// READY
// =========================

client.once("ready", async () => {
  console.log(`${client.user.tag} aktif!`);

  for (const guild of client.guilds.cache.values()) {
    try {
      await setupMainRoles(guild);
    } catch (err) {
      console.log("Rol oluşturma hatası:", err.message);
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

// =========================
// ÜYE GİRİŞİ
// =========================

client.on("guildMemberAdd", async member => {
  const channel = member.guild.channels.cache.find(
    c =>
      c.type === ChannelType.GuildText &&
      ["kayıt", "kayit", "register"].includes(c.name.toLowerCase())
  );

  if (!channel) return;

  const kayıtRol = member.guild.roles.cache.find(
    r => r.name.toLowerCase() === "kayıtsız"
  );

  const kayıtYetkilisi = member.guild.roles.cache.get(ROLES.KAYIT);

  const embed = new EmbedBuilder()
    .setTitle("👋 Yeni Oyuncu Geldi!")
    .setDescription(
      `${member} sunucuya katıldı.\n\n` +
      `Kayıt işlemi için yetkili bekleniyor.`
    )
    .setColor("#3498DB")
    .setTimestamp();

  await channel.send({
    content: kayıtYetkilisi ? `<@&${ROLES.KAYIT}>` : null,
    embeds: [embed]
  }).catch(() => {});
});

// =========================
// MESAJ SİSTEMİ
// =========================

client.on("messageCreate", async message => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const args = message.content.trim().split(/\s+/);
  const command = args.shift()?.toLowerCase();

  if (!command || !command.startsWith(".")) return;

  const cmd = command.slice(1);

  // =========================
  // YARDIM
  // =========================

  if (cmd === "yardım" || cmd === "help") {
    const embed = new EmbedBuilder()
      .setTitle("⚽ Legendary League Bot")
      .setColor("#2F3136")
      .setDescription(
        [
          "**👤 Oyuncu**",
          "`.k @oyuncu isim`",
          "`.dver @oyuncu miktar`",
          "`.değer @oyuncu`",
          "",
          "**🏋️ Gelişim**",
          "`.antrenman` / `.ant`",
          "`.pen` / `.penaltı`",
          "",
          "**🏟️ Takım**",
          "`.takımkur takımadı`",
          "`.kadro @oyuncu`",
          "`.takım`",
          "",
          "**⚔️ Maç**",
          "`.maç @takım1 @takım2`",
          "",
          "**🔄 Transfer**",
          "`.transfer @oyuncu miktar`",
          "`.kap @oyuncu miktar`",
          "",
          "**🏢 Şirket / Sponsor**",
          "`.şirketkur şirketadı`",
          "`.sponsor şirketadı takımadı miktar`",
          "",
          "**🎁 Çekiliş**",
          "`.çekiliş ödül süre`",
          "",
          "**🛡️ Moderasyon**",
          "`.kick @üye`",
          "`.ban @üye`",
          "`.mute @üye`",
          "`.unmute @üye`",
          "`.sil miktar`",
          "",
          "**📢 Reklam / DM**",
          "`.reklam`",
          "`.dm all mesaj`",
          "",
          "**⚙️ Yönetim**",
          "`.embed başlık | açıklama`",
          "`.kilit`",
          "`.aç`"
        ].join("\n")
      );

    return message.reply({ embeds: [embed] });
  }

  // =========================
  // KAYIT
  // =========================

  if (cmd === "k") {
    if (!hasRole(message.member, ROLES.KAYIT)) {
      return message.reply("❌ Bu komut için Kayıt Yetkilisi olmalısın.");
    }

    const user = message.mentions.members.first();
    const isim = args.slice(1).join(" ");

    if (!user || !isim) {
      return message.reply("Kullanım: `.k @oyuncu isim`");
    }

    const futbolcu = message.guild.roles.cache.find(
      r => r.name === "⚽ FUTBOLCU"
    );

    const kayıtsız = message.guild.roles.cache.find(
      r => r.name.toLowerCase() === "kayıtsız"
    );

    if (futbolcu) await user.roles.add(futbolcu).catch(() => {});
    if (kayıtsız) await user.roles.remove(kayıtsız).catch(() => {});

    await user.setNickname(`${isim} | ⚽ | 0€`).catch(() => {});

    const data = getUserData(user.id);
    data.registered = true;
    save();

    const embed = new EmbedBuilder()
      .setTitle("✅ Kayıt Tamamlandı")
      .setColor("#2ECC71")
      .setDescription(
        `${user} başarıyla kayıt edildi.\n\n` +
        `👤 İsim: **${isim}**\n` +
        `⚽ Rol: **Futbolcu**\n` +
        `👮 Kayıt Yetkilisi: ${message.author}`
      )
      .setTimestamp();

    return message.channel.send({ embeds: [embed] });
  }

  // =========================
  // DEĞER VER
  // =========================

  if (cmd === "dver") {
    if (!hasRole(message.member, ROLES.DEGER)) {
      return message.reply("❌ Bu komut için Değer Yetkilisi olmalısın.");
    }

    const user = message.mentions.members.first();
    const amount = args[1];

    if (!user || !amount) {
      return message.reply("Kullanım: `.dver @oyuncu 5M`");
    }

    const add = moneyToNumber(amount);
    if (add <= 0) return message.reply("❌ Geçerli bir miktar gir.");

    const data = getUserData(user.id);

    data.value += add;
    save();

    const oldNick = user.nickname || user.user.username;

    let name = oldNick
      .replace(/\|\s*[\d.,]+(?:K|M)?€\s*$/i, "")
      .trim();

    if (!name.includes("|")) {
      name = oldNick.split("|")[0].trim();
    }

    const newNick = `${name} | ${formatMoney(data.value)}`;

    await user.setNickname(newNick).catch(() => {});

    return message.reply(
      `✅ ${user} değerine **${formatMoney(add)}** eklendi.\n` +
      `💰 Yeni değer: **${formatMoney(data.value)}**`
    );
  }

  // =========================
  // DEĞER GÖR
  // =========================

  if (cmd === "değer" || cmd === "deger") {
    const user = message.mentions.members.first() || message.member;
    const data = getUserData(user.id);

    return message.reply(
      `💰 ${user} oyuncusunun değeri: **${formatMoney(data.value)}**`
    );
  }

  // =========================
  // ANTRENMAN
  // =========================

  if (cmd === "antrenman" || cmd === "ant") {
    const data = getUserData(message.author.id);

    data.training++;

    let reward = 0;

    if (data.training >= 10) {
      data.training = 0;
      reward = 300000;
      data.value += reward;
    }

    save();

    return message.reply(
      `🏋️ Antrenman tamamlandı!\n` +
      `📊 İlerleme: **${data.training}/10**\n` +
      (reward
        ? `🎉 10/10 tamamlandı! **3M€** değer kazandın.\n💰 Yeni değer: **${formatMoney(data.value)}**`
        : "")
    );
  }

  // =========================
  // PENALTI
  // =========================

  if (cmd === "pen" || cmd === "penaltı" || cmd === "penalti") {
    const data = getUserData(message.author.id);
    const goal = Math.random() < 0.5;

    if (goal) {
      data.goals++;
      data.value += 2000000;
      save();

      return message.reply(
        `🥅 **GOOOL!** ⚽\n` +
        `💰 +2M€\n` +
        `📊 Toplam değer: **${formatMoney(data.value)}**`
      );
    }

    return message.reply("🥅 ❌ Kaçtı!");
  }

  // =========================
  // TAKIM KUR
  // =========================

  if (cmd === "takımkur" || cmd === "takimkur") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Bu komutu sadece yönetici kullanabilir.");
    }

    const teamName = args.join(" ");

    if (!teamName) {
      return message.reply("Kullanım: `.takımkur Galatasaray`");
    }

    if (db.teams[teamName.toLowerCase()]) {
      return message.reply("❌ Bu takım zaten mevcut.");
    }

    const role = await message.guild.roles.create({
      name: `🏟️ ${teamName}`,
      color: Math.floor(Math.random() * 16777215),
      hoist: true,
      mentionable: true
    });

    db.teams[teamName.toLowerCase()] = {
      name: teamName,
      roleId: role.id,
      owner: message.author.id,
      budget: 0,
      players: []
    };

    save();

    return message.reply(
      `🏟️ **${teamName}** takımı oluşturuldu!\n` +
      `🎨 Takım rolü: ${role}\n` +
      `👤 Teknik Direktör: ${message.author}`
    );
  }

  // =========================
  // KADRO
  // =========================

  if (cmd === "kadro") {
    const user = message.mentions.members.first();

    if (!user) {
      return message.reply("Kullanım: `.kadro @oyuncu`");
    }

    const team = Object.values(db.teams).find(
      t => t.owner === message.author.id
    );

    if (!team) {
      return message.reply("❌ Bir takımın Teknik Direktörü değilsin.");
    }

    if (!team.players.includes(user.id)) {
      team.players.push(user.id);
    }

    const role = message.guild.roles.cache.get(team.roleId);

    if (role) {
      await user.roles.add(role).catch(() => {});
    }

    const data = getUserData(user.id);
    data.team = team.name;

    save();

    return message.reply(
      `✅ ${user}, **${team.name}** kadrosuna eklendi.`
    );
  }

  // =========================
  // TAKIM
  // =========================

  if (cmd === "takım" || cmd === "takim") {
    const team = Object.values(db.teams).find(
      t => t.players.includes(message.author.id) ||
        t.owner === message.author.id
    );

    if (!team) return message.reply("❌ Bir takımın bulunmuyor.");

    const embed = new EmbedBuilder()
      .setTitle(`🏟️ ${team.name}`)
      .setColor("#3498DB")
      .addFields(
        {
          name: "🎩 Teknik Direktör",
          value: `<@${team.owner}>`
        },
        {
          name: "👥 Kadro",
          value:
            team.players.length > 0
              ? team.players.map(id => `<@${id}>`).join("\n")
              : "Henüz oyuncu yok."
        },
        {
          name: "💰 Bütçe",
          value: formatMoney(team.budget)
        }
      );

    return message.reply({ embeds: [embed] });
  }

  // =========================
  // MAÇ
  // =========================

  if (cmd === "maç" || cmd === "mac") {
    const team1 = args[0]?.replace(/[<@&>]/g, "");
    const team2 = args[1]?.replace(/[<@&>]/g, "");

    if (!team1 || !team2) {
      return message.reply("Kullanım: `.maç @takım1 @takım2`");
    }

    const t1 = Object.values(db.teams).find(
      t => t.roleId === team1
    );

    const t2 = Object.values(db.teams).find(
      t => t.roleId === team2
    );

    if (!t1 || !t2) {
      return message.reply("❌ Takımlar bulunamadı.");
    }

    await message.channel.send(
      `⚽ **MAÇ BAŞLIYOR!**\n\n🏟️ ${t1.name} vs ${t2.name}`
    );

    const events = [
      "⚡ Orta saha mücadelesi!",
      "🎯 Tehlikeli şut!",
      "🧤 Kaleci kurtardı!",
      "🔥 Baskı artıyor!",
      "⚽ GOOOOOL!"
    ];

    for (let i = 0; i < 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await message.channel.send(
        events[Math.floor(Math.random() * events.length)]
      );
    }

    const score1 = Math.floor(Math.random() * 5);
    const score2 = Math.floor(Math.random() * 5);

    return message.channel.send(
      `🏁 **MAÇ SONUCU**\n\n` +
      `🏟️ ${t1.name} **${score1} - ${score2}** ${t2.name}`
    );
  }

  // =========================
  // TRANSFER
  // =========================

  if (cmd === "transfer") {
    const user = message.mentions.members.first();
    const amount = args[1];

    if (!user || !amount) {
      return message.reply("Kullanım: `.transfer @oyuncu 5M`");
    }

    const team = Object.values(db.teams).find(
      t => t.owner === message.author.id
    );

    if (!team) return message.reply("❌ Teknik Direktör değilsin.");

    const value = moneyToNumber(amount);

    if (team.budget < value) {
      return message.reply("❌ Takım bütçesi yetersiz.");
    }

    team.budget -= value;

    const data = getUserData(user.id);
    data.team = team.name;

    save();

    return message.channel.send(
      `🔄 **Transfer gerçekleşti!**\n` +
      `👤 Oyuncu: ${user}\n` +
      `🏟️ Takım: **${team.name}**\n` +
      `💰 Bedel: **${formatMoney(value)}**`
    );
  }

  // =========================
  // KAP
  // =========================

  if (cmd === "kap") {
    const user = message.mentions.members.first();
    const amount = args[1];

    if (!user || !amount) {
      return message.reply("Kullanım: `.kap @oyuncu 5M`");
    }

    const value = moneyToNumber(amount);

    const embed = new EmbedBuilder()
      .setTitle("📄 KAP — Transfer Teklifi")
      .setColor("#F1C40F")
      .addFields(
        {
          name: "👤 Oyuncu",
          value: `${user}`
        },
        {
          name: "💰 Teklif",
          value: formatMoney(value)
        },
        {
          name: "👔 Teklifi yapan",
          value: `${message.author}`
        }
      )
      .setTimestamp();

    return message.channel.send({ embeds: [embed] });
  }

  // =========================
  // ŞİRKET
  // =========================

  if (cmd === "şirketkur" || cmd === "sirketkur") {
    const name = args.join(" ");

    if (!name) {
      return message.reply("Kullanım: `.şirketkur Şirket Adı`");
    }

    const key = name.toLowerCase();

    if (db.companies[key]) {
      return message.reply("❌ Bu şirket zaten var.");
    }

    const role = await createRole(
      message.guild,
      `🏢 ${name}`,
      "#F1C40F"
    );

    db.companies[key] = {
      name,
      owner: message.author.id,
      roleId: role.id,
      budget: 0
    };

    save();

    await message.member.roles.add(role).catch(() => {});

    return message.reply(
      `🏢 **${name}** şirketi oluşturuldu!\n` +
      `👤 Sahibi: ${message.author}\n` +
      `🎨 Şirket rolü: ${role}`
    );
  }

  // =========================
  // SPONSOR
  // =========================

  if (cmd === "sponsor") {
    const company = args[0];
    const team = args[1];
    const amount = args[2];

    if (!company || !team || !amount) {
      return message.reply(
        "Kullanım: `.sponsor şirketadı takımadı miktar`"
      );
    }

    const companyData = db.companies[company.toLowerCase()];
    const teamData = db.teams[team.toLowerCase()];
    const value = moneyToNumber(amount);

    if (!companyData) {
      return message.reply("❌ Şirket bulunamadı.");
    }

    if (!teamData) {
      return message.reply("❌ Takım bulunamadı.");
    }

    if (companyData.owner !== message.author.id && !isAdmin(message.member)) {
      return message.reply("❌ Bu şirketin sahibi değilsin.");
    }

    if (companyData.budget < value) {
      return message.reply("❌ Şirket bütçesi yetersiz.");
    }

    companyData.budget -= value;
    teamData.budget += value;

    const sponsorRole = await createRole(
      message.guild,
      `💼 SPONSOR • ${companyData.name}`,
      "#2ECC71"
    );

    db.sponsors[`${companyData.name}-${teamData.name}`] = {
      company: companyData.name,
      team: teamData.name,
      amount: value,
      roleId: sponsorRole.id
    };

    save();

    return message.channel.send(
      `💼 **SPONSORLUK ANLAŞMASI**\n\n` +
      `🏢 Şirket: **${companyData.name}**\n` +
      `🏟️ Takım: **${teamData.name}**\n` +
      `💰 Sponsor bedeli: **${formatMoney(value)}**`
    );
  }

  // =========================
  // REKLAM
  // =========================

  if (cmd === "reklam") {
    const embed = new EmbedBuilder()
      .setTitle("📢 Reklam Paketleri")
      .setColor("#E67E22")
      .setDescription(
        [
          "🥉 **Bronz:** 150K€",
          "🥈 **Gümüş:** 300K€",
          "🥇 **Altın:** 600K€",
          "💎 **Platin:** 1.2M€",
          "👑 **Legendary:** 2.4M€",
          "🌟 **Ultimate:** 4.8M€",
          "",
          "📣 `@everyone` hakkı: 100K€",
          "📢 `@here` hakkı: 50K€",
          "🔢 Maksimum hak: 5"
        ].join("\n")
      );

    return message.channel.send({ embeds: [embed] });
  }

  // =========================
  // ÇEKİLİŞ
  // =========================

  if (cmd === "çekiliş" || cmd === "cekilis") {
    if (!hasRole(message.member, ROLES.YONETICI)) {
      return message.reply("❌ Çekiliş yetkilisi değilsin.");
    }

    const prize = args[0];
    const durationText = args[1];

    if (!prize || !durationText) {
      return message.reply("Kullanım: `.çekiliş 5M€ 5m`");
    }

    const match = durationText.match(/^(\d+)(s|m|h)$/i);

    if (!match) {
      return message.reply("❌ Süre örneği: `30s`, `5m`, `2h`");
    }

    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();

    let duration = amount * 1000;

    if (unit === "m") duration = amount * 60 * 1000;
    if (unit === "h") duration = amount * 60 * 60 * 1000;

    const embed = new EmbedBuilder()
      .setTitle("🎁 ÇEKİLİŞ")
      .setColor("#9B59B6")
      .setDescription(
        `🎁 Ödül: **${prize}**\n\n` +
        `Katılmak için 🎉 butonuna bas.`
      );

    const button = new ButtonBuilder()
      .setCustomId("giveaway_join")
      .setLabel("🎉 Katıl")
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    const msg = await message.channel.send({
      embeds: [embed],
      components: [row]
    });

    db.giveaways[msg.id] = {
      prize,
      participants: [],
      end: Date.now() + duration
    };

    save();

    setTimeout(async () => {
      const giveaway = db.giveaways[msg.id];

      if (!giveaway) return;

      if (giveaway.participants.length === 0) {
        await message.channel.send("🎁 Çekiliş bitti fakat katılan olmadı.");
      } else {
        const winner =
          giveaway.participants[
            Math.floor(Math.random() * giveaway.participants.length)
          ];

        await message.channel.send(
          `🎉 Çekiliş sona erdi!\n\n` +
          `🏆 Ödül: **${giveaway.prize}**\n` +
          `👑 Kazanan: <@${winner}>`
        );
      }

      delete db.giveaways[msg.id];
      save();
    }, duration);

    return;
  }

  // =========================
  // ÇEKİLİŞ BUTONU
  // =========================

  if (message.author.bot) return;
});

// =========================
// BUTONLAR
// =========================

client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;

  if (interaction.customId === "giveaway_join") {
    const giveaway = db.giveaways[interaction.message.id];

    if (!giveaway) {
      return interaction.reply({
        content: "❌ Bu çekiliş artık aktif değil.",
        ephemeral: true
      });
    }

    if (giveaway.participants.includes(interaction.user.id)) {
      return interaction.reply({
        content: "❌ Zaten çekilişe katıldın.",
        ephemeral: true
      });
    }

    giveaway.participants.push(interaction.user.id);
    save();

    return interaction.reply({
      content: "🎉 Çekilişe başarıyla katıldın!",
      ephemeral: true
    });
  }
});

// =========================
// MODERASYON
// =========================

client.on("messageCreate", async message => {
  if (message.author.bot || !message.guild) return;

  const args = message.content.trim().split(/\s+/);
  const command = args.shift()?.toLowerCase();

  if (!command?.startsWith(".")) return;

  const cmd = command.slice(1);

  // KICK
  if (cmd === "kick") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Yetkin yok.");
    }

    const user = message.mentions.members.first();

    if (!user) return message.reply("Kullanım: `.kick @üye`");

    await user.kick().catch(() => {});

    return message.reply(`👢 ${user.user.tag} sunucudan atıldı.`);
  }

  // BAN
  if (cmd === "ban") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Yetkin yok.");
    }

    const user = message.mentions.members.first();

    if (!user) return message.reply("Kullanım: `.ban @üye`");

    await user.ban().catch(() => {});

    return message.reply(`🔨 ${user.user.tag} yasaklandı.`);
  }

  // MUTE
  if (cmd === "mute") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Yetkin yok.");
    }

    const user = message.mentions.members.first();

    if (!user) return message.reply("Kullanım: `.mute @üye`");

    let role = message.guild.roles.cache.find(
      r => r.name === "🔇 Mute"
    );

    if (!role) {
      role = await message.guild.roles.create({
        name: "🔇 Mute",
        color: "#7F8C8D"
      });
    }

    await user.roles.add(role).catch(() => {});

    return message.reply(`🔇 ${user} susturuldu.`);
  }

  // UNMUTE
  if (cmd === "unmute") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Yetkin yok.");
    }

    const user = message.mentions.members.first();

    if (!user) return message.reply("Kullanım: `.unmute @üye`");

    const role = message.guild.roles.cache.find(
      r => r.name === "🔇 Mute"
    );

    if (role) await user.roles.remove(role).catch(() => {});

    return message.reply(`🔊 ${user} susturması kaldırıldı.`);
  }

  // SİL
  if (cmd === "sil") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Yetkin yok.");
    }

    let amount = Number(args[0]);

    if (!amount || amount < 1) {
      return message.reply("Kullanım: `.sil 100`");
    }

    if (amount > 1000) amount = 1000;

    let deleted = 0;

    while (amount > 0) {
      const count = Math.min(amount, 100);
      const messages = await message.channel.messages.fetch({
        limit: count
      });

      if (!messages.size) break;

      const deletable = messages.filter(
        m => Date.now() - m.createdTimestamp < 14 * 24 * 60 * 60 * 1000
      );

      if (!deletable.size) break;

      await message.channel.bulkDelete(deletable, true).catch(() => {});
      deleted += deletable.size;
      amount -= deletable.size;

      if (deletable.size < count) break;
    }

    return message.channel.send(`🗑️ **${deleted}** mesaj silindi.`);
  }

  // KİLİT
  if (cmd === "kilit") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Yetkin yok.");
    }

    await message.channel.permissionOverwrites.edit(
      message.guild.roles.everyone,
      {
        SendMessages: false
      }
    );

    return message.channel.send("🔒 Kanal kilitlendi.");
  }

  // AÇ
  if (cmd === "aç" || cmd === "ac") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Yetkin yok.");
    }

    await message.channel.permissionOverwrites.edit(
      message.guild.roles.everyone,
      {
        SendMessages: null
      }
    );

    return message.channel.send("🔓 Kanalın kilidi açıldı.");
  }

  // EMBED
  if (cmd === "embed") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Yetkin yok.");
    }

    const text = args.join(" ");
    const split = text.split("|");

    if (!split[0] || !split[1]) {
      return message.reply(
        "Kullanım: `.embed Başlık | Açıklama`"
      );
    }

    const embed = new EmbedBuilder()
      .setTitle(split[0].trim())
      .setDescription(split.slice(1).join("|").trim())
      .setColor("#3498DB")
      .setTimestamp();

    return message.channel.send({ embeds: [embed] });
  }

  // DM ALL
  if (cmd === "dm") {
    if (!isAdmin(message.member)) {
      return message.reply("❌ Yetkin yok.");
    }

    if (args[0]?.toLowerCase() !== "all") {
      return message.reply("Kullanım: `.dm all mesaj`");
    }

    const text = args.slice(1).join(" ");

    if (!text) return message.reply("❌ DM mesajı boş olamaz.");

    let sent = 0;

    await message.guild.members.fetch();

    for (const member of message.guild.members.cache.values()) {
      if (member.user.bot) continue;

      await member.send(text)
        .then(() => sent++)
        .catch(() => {});
    }

    return message.reply(
      `📨 DM gönderimi tamamlandı.\n✅ Gönderilen: **${sent}**`
    );
  }
});

// =========================
// LOGIN
// =========================

client.login(TOKEN);
