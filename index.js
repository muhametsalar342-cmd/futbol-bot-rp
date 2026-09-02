const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionsBitField,
  ActivityType
} = require("discord.js");

const fs = require("fs");
const path = require("path");

// =====================================================
// AYARLAR
// =====================================================

const TOKEN = process.env.TOKEN;

const ANNOUNCEMENT_CHANNEL_ID = "1544653653330108477";
const KAYIT_YETKILISI_ROLE_ID = "1544452022764568656";
const YONETICI_ROLE_ID = "1544449436011339806";
const DEGER_YETKILISI_ROLE_ID = "1544451743746891806";

const BOT_ACTIVITY = "United League | Futbol Rp";

// =====================================================
// CLIENT
// =====================================================

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
    Partials.User
  ]
});

// =====================================================
// DATA
// =====================================================

const DATA_FILE = path.join(__dirname, "data.json");

const DEFAULT_DATA = {
  players: {},
  teams: {},
  transfers: [],
  kap: {},
  matches: [],
  giveaways: {},
  companies: {},
  sponsors: {},
  ads: {},
  season: {
    number: 1,
    startedAt: Date.now()
  }
};

let data;

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      data = JSON.parse(JSON.stringify(DEFAULT_DATA));
      saveData();
      return;
    }

    data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

    for (const key of Object.keys(DEFAULT_DATA)) {
      if (data[key] === undefined) {
        data[key] = JSON.parse(JSON.stringify(DEFAULT_DATA[key]));
      }
    }
  } catch (err) {
    console.error("data.json okunamadı:", err);
    data = JSON.parse(JSON.stringify(DEFAULT_DATA));
    saveData();
  }
}

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Data kaydedilemedi:", err);
  }
}

loadData();

// =====================================================
// YARDIMCI FONKSİYONLAR
// =====================================================

function getPlayer(userId) {
  if (!data.players[userId]) {
    data.players[userId] = {
      registered: false,
      roleType: null,
      value: 0,
      training: 0,
      goals: 0,
      assists: 0,
      matches: 0,
      xp: 0,
      achievements: [],
      budget: 0
    };
  }

  return data.players[userId];
}

function hasRole(member, roleId) {
  return member.roles.cache.has(roleId);
}

function isAdmin(member) {
  return (
    member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    hasRole(member, YONETICI_ROLE_ID)
  );
}

function isRegistrationStaff(member) {
  return isAdmin(member) || hasRole(member, KAYIT_YETKILISI_ROLE_ID);
}

function isValueStaff(member) {
  return isAdmin(member) || hasRole(member, DEGER_YETKILISI_ROLE_ID);
}

function parseMoney(input) {
  if (!input) return null;

  let value = String(input)
    .toLowerCase()
    .replace(/€/g, "")
    .replace(/\s/g, "")
    .replace(/,/g, ".");

  let multiplier = 1;

  if (value.endsWith("k")) {
    multiplier = 1000;
    value = value.slice(0, -1);
  } else if (value.endsWith("m")) {
    multiplier = 1000000;
    value = value.slice(0, -1);
  } else if (value.endsWith("b")) {
    multiplier = 1000000000;
    value = value.slice(0, -1);
  }

  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    return null;
  }

  return Math.round(number * multiplier);
}

function formatMoney(amount) {
  amount = Math.max(0, Math.round(Number(amount) || 0));

  if (amount >= 1000000000) {
    return `${(amount / 1000000000).toFixed(2).replace(/\.00$/, "")}B€`;
  }

  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(2).replace(/\.00$/, "")}M€`;
  }

  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(2).replace(/\.00$/, "")}K€`;
  }

  return `${amount}€`;
}

// =====================================================
// NICKNAME DEĞERİ
// =====================================================

function getNicknameValue(nickname) {
  if (!nickname) return 0;

  const match = nickname.match(
    /(?:^|\|\s*)([\d.,]+)\s*(K|M|B)?€?\s*$/i
  );

  if (!match) return 0;

  let number = match[1].replace(/,/g, ".");
  let multiplier = 1;

  if (match[2]) {
    const unit = match[2].toLowerCase();

    if (unit === "k") multiplier = 1000;
    if (unit === "m") multiplier = 1000000;
    if (unit === "b") multiplier = 1000000000;
  }

  const parsed = Number(number);

  if (!Number.isFinite(parsed)) return 0;

  return Math.round(parsed * multiplier);
}

function updateNicknameValue(nickname, newValue) {
  const formatted = formatMoney(newValue);

  const regex =
    /(?:\|\s*)?[\d.,]+\s*(?:K|M|B)?€?\s*$/i;

  if (regex.test(nickname)) {
    return nickname.replace(regex, `| ${formatted}`);
  }

  return `${nickname} | ${formatted}`;
}

async function changePlayerValue(member, amount) {
  const oldValue = getNicknameValue(member.nickname || member.user.username);
  const newValue = Math.max(0, oldValue + amount);

  let nickname = member.nickname || member.user.username;

  nickname = updateNicknameValue(nickname, newValue);

  // Discord maksimum nickname uzunluğu
  if (nickname.length > 32) {
    const valuePart = ` | ${formatMoney(newValue)}`;
    nickname =
      nickname.slice(0, 32 - valuePart.length) + valuePart;
  }

  try {
    await member.setNickname(nickname);
  } catch (err) {
    console.error("Nickname değiştirilemedi:", err);
  }

  const player = getPlayer(member.id);
  player.value = newValue;

  saveData();

  return {
    oldValue,
    newValue
  };
}

// =====================================================
// ROL OLUŞTURMA
// =====================================================

async function getOrCreateRole(guild, roleName, color) {
  let role = guild.roles.cache.find(
    r => r.name.toLowerCase() === roleName.toLowerCase()
  );

  if (role) return role;

  role = await guild.roles.create({
    name: roleName,
    color,
    hoist: true,
    reason: "United League kayıt sistemi"
  });

  return role;
}

// =====================================================
// KANAL BULMA
// =====================================================

function findChannel(guild, names) {
  return guild.channels.cache.find(channel => {
    if (!channel.isTextBased()) return false;

    return names.some(
      name => channel.name.toLowerCase() === name.toLowerCase()
    );
  });
}

// =====================================================
// YENİ ÜYE
// =====================================================

client.on("guildMemberAdd", async member => {
  try {
    const kayitsiz = await getOrCreateRole(
      member.guild,
      "Kayıtsız",
      0x808080
    );

    if (!member.roles.cache.has(kayitsiz.id)) {
      await member.roles.add(kayitsiz);
    }

    getPlayer(member.id);
    saveData();

    const kayitChannel = findChannel(member.guild, [
      "kayıt",
      "kayit"
    ]);

    if (!kayitChannel) {
      console.log("Kayıt kanalı bulunamadı.");
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle("🎉 HOŞ GELDİN!")
      .setDescription(
        `**${member}** United League sunucusuna hoş geldin! ⚽🏆\n\n` +
        `📝 **Kayıt işlemin için lütfen bir Kayıt Yetkilisi bekle.**\n\n` +
        `<@&${KAYIT_YETKILISI_ROLE_ID}> yeni oyuncunun kaydıyla ilgilenebilir.`
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setFooter({
        text: "United League • Futbol RP"
      })
      .setTimestamp();

    await kayitChannel.send({
      content: `<@&${KAYIT_YETKILISI_ROLE_ID}>`,
      embeds: [embed],
      allowedMentions: {
        roles: [KAYIT_YETKILISI_ROLE_ID],
        users: [member.id]
      }
    });

  } catch (err) {
    console.error("guildMemberAdd hatası:", err);
  }
});

// =====================================================
// KAYIT KOMUTU
// .k @oyuncu İsim
// =====================================================

async function registrationCommand(message, args) {
  if (!isRegistrationStaff(message.member)) {
    return message.reply(
      "❌ Bu komutu yalnızca **Kayıt Yetkilisi** kullanabilir."
    );
  }

  const target = message.mentions.members.first();

  if (!target) {
    return message.reply(
      "❌ Kullanım: `.k @oyuncu İsim`"
    );
  }

  const name = args.slice(1).join(" ").trim();

  if (!name) {
    return message.reply(
      "❌ Oyuncunun ismini yazmalısın.\nÖrnek: `.k @Oyuncu W.Sneijder`"
    );
  }

  const futbolcuRole = await getOrCreateRole(
    message.guild,
    "Futbolcu",
    0x2ecc71
  );

  const tdRole = await getOrCreateRole(
    message.guild,
    "Teknik Direktör",
    0xe67e22
  );

  const kayitsizRole = message.guild.roles.cache.find(
    r => r.name.toLowerCase() === "kayıtsız"
  );

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("📝 OYUNCU KAYDI")
    .setDescription(
      `**${target}** için kayıt işlemi başlatıldı.\n\n` +
      `Aşağıdaki butonlardan oyuncunun rolünü seçin.`
    )
    .addFields(
      {
        name: "👤 Oyuncu",
        value: `${target}`,
        inline: true
      },
      {
        name: "🏷️ İsim",
        value: `\`${name}\``,
        inline: true
      }
    )
    .setFooter({
      text: "United League • Kayıt Sistemi"
    })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`register_player_${target.id}_${name}`)
      .setLabel("Futbolcu")
      .setEmoji("⚽")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId(`register_td_${target.id}_${name}`)
      .setLabel("Teknik Direktör")
      .setEmoji("🧠")
      .setStyle(ButtonStyle.Primary)
  );

  await message.channel.send({
    embeds: [embed],
    components: [row]
  });
}

// =====================================================
// BUTONLAR
// =====================================================

client.on("interactionCreate", async interaction => {
  try {
    if (!interaction.isButton() && !interaction.isModalSubmit()) {
      return;
    }

    // =================================================
    // KAYIT BUTONLARI
    // =================================================

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("register_")
    ) {
      if (!isRegistrationStaff(interaction.member)) {
        return interaction.reply({
          content: "❌ Bu işlem yalnızca **Kayıt Yetkilisi** tarafından yapılabilir.",
          ephemeral: true
        });
      }

      const parts = interaction.customId.split("_");

      const type = parts[1];
      const targetId = parts[2];
      const playerName = parts.slice(3).join("_");

      const target = await interaction.guild.members
        .fetch(targetId)
        .catch(() => null);

      if (!target) {
        return interaction.reply({
          content: "❌ Oyuncu artık sunucuda değil.",
          ephemeral: true
        });
      }

      const futbolcuRole = await getOrCreateRole(
        interaction.guild,
        "Futbolcu",
        0x2ecc71
      );

      const tdRole = await getOrCreateRole(
        interaction.guild,
        "Teknik Direktör",
        0xe67e22
      );

      const kayitsizRole = interaction.guild.roles.cache.find(
        r => r.name.toLowerCase() === "kayıtsız"
      );

      let selectedRole;

      if (type === "player") {
        selectedRole = futbolcuRole;
      } else {
        selectedRole = tdRole;
      }

      // Bot rol kontrolü
      if (
        interaction.guild.members.me.roles.highest.position <=
        selectedRole.position
      ) {
        return interaction.reply({
          content:
            "❌ Botun rolü, vereceği rolün üzerinde olmalı. Discord'da bot rolünü yukarı taşı.",
          ephemeral: true
        });
      }

      await target.roles.add(selectedRole);

      if (kayitsizRole && target.roles.cache.has(kayitsizRole.id)) {
        await target.roles.remove(kayitsizRole);
      }

      const player = getPlayer(target.id);

      player.registered = true;
      player.roleType =
        type === "player"
          ? "Futbolcu"
          : "Teknik Direktör";

      saveData();

      try {
        await target.setNickname(
          updateNicknameValue(playerName, player.value)
        );
      } catch (err) {
        console.log("Kayıt sonrası nickname ayarlanamadı.");
      }

      const roleText =
        type === "player"
          ? "⚽ Futbolcu"
          : "🧠 Teknik Direktör";

      const successEmbed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("✅ KAYIT TAMAMLANDI")
        .setDescription(
          `🎉 ${target} **United League** ailesine katıldı!\n\n` +
          `👤 **İsim:** ${playerName}\n` +
          `🏷️ **Rol:** ${roleText}\n\n` +
          `Kayıt işlemi **${interaction.user}** tarafından tamamlandı.`
        )
        .setThumbnail(
          target.user.displayAvatarURL({ dynamic: true })
        )
        .setFooter({
          text: "United League • Futbol RP"
        })
        .setTimestamp();

      await interaction.update({
        embeds: [successEmbed],
        components: []
      });

      // Genel hoş geldin
      const chatChannel = findChannel(interaction.guild, [
        "sohbet",
        "genel",
        "chat"
      ]);

      if (chatChannel) {
        await chatChannel.send({
          content: `${target}`,
          embeds: [
            new EmbedBuilder()
              .setColor(0x2ecc71)
              .setTitle("🎉 ARAMIZA HOŞ GELDİN!")
              .setDescription(
                `**${playerName}**, United League'e hoş geldin! ⚽🏆\n\n` +
                `🏷️ **Rolün:** ${roleText}\n\n` +
                `İyi eğlenceler ve başarılar!`
              )
              .setFooter({
                text: "United League • Futbol RP"
              })
              .setTimestamp()
          ],
          allowedMentions: {
            users: [target.id]
          }
        });
      }

      return;
    }

    // =================================================
    // KAP MAAŞ MODALI
    // =================================================

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("kap_salary_")
    ) {
      const kapId = interaction.customId.replace("kap_salary_", "");
      const kap = data.kap[kapId];

      if (!kap) {
        return interaction.reply({
          content: "❌ Bu KAP artık geçerli değil.",
          ephemeral: true
        });
      }

      if (interaction.user.id !== kap.playerId) {
        return interaction.reply({
          content: "❌ Bu KAP'ın maaşını yalnızca oyuncu değiştirebilir.",
          ephemeral: true
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(`kap_modal_${kapId}`)
        .setTitle("💰 Maaş Teklifi");

      const salaryInput = new TextInputBuilder()
        .setCustomId("salary")
        .setLabel("Yeni maaş")
        .setPlaceholder("Örn: 5M€")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(20);

      modal.addComponents(
        new ActionRowBuilder().addComponents(salaryInput)
      );

      return interaction.showModal(modal);
    }

    // =================================================
    // KAP KABUL
    // =================================================

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("kap_accept_")
    ) {
      const kapId = interaction.customId.replace("kap_accept_", "");
      const kap = data.kap[kapId];

      if (!kap) {
        return interaction.reply({
          content: "❌ Bu KAP artık geçerli değil.",
          ephemeral: true
        });
      }

      if (interaction.user.id !== kap.playerId) {
        return interaction.reply({
          content: "❌ Bu KAP yalnızca oyuncu tarafından kabul edilebilir.",
          ephemeral: true
        });
      }

      kap.playerAccepted = true;
      kap.status = "oyuncu_kabul_etti";

      saveData();

      const target = await interaction.guild.members
        .fetch(kap.playerId)
        .catch(() => null);

      const playerTeam = Object.values(data.teams).find(
        team => team.ownerId === kap.playerId
      );

      if (playerTeam && playerTeam.tdId) {
        kap.waitingForTD = true;
        kap.tdId = playerTeam.tdId;

        saveData();

        await interaction.update({
          content: `<@${kap.tdId}>`,
          embeds: [
            new EmbedBuilder()
              .setColor(0xf1c40f)
              .setTitle("🏆 KAP • TEKNİK DİREKTÖR ONAYI")
              .setDescription(
                `Oyuncu **${target || "Oyuncu"}** KAP teklifini kabul etti.\n\n` +
                `👤 Oyuncu: <@${kap.playerId}>\n` +
                `🏟️ Takım: **${kap.buyingTeamName}**\n` +
                `💰 Maaş: **${formatMoney(kap.salary)}**\n\n` +
                `Oyuncu takım sahibi olduğu için Teknik Direktör onayı gerekiyor.`
              )
              .setFooter({
                text: "United League • KAP Sistemi"
              })
              .setTimestamp()
          ],
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`kap_td_accept_${kapId}`)
                .setLabel("Teknik Direktör Onayla")
                .setEmoji("✅")
                .setStyle(ButtonStyle.Success),

              new ButtonBuilder()
                .setCustomId(`kap_td_reject_${kapId}`)
                .setLabel("Reddet")
                .setEmoji("❌")
                .setStyle(ButtonStyle.Danger)
            )
          ],
          allowedMentions: {
            users: [kap.tdId]
          }
        });

        return;
      }

      kap.status = "tamamlandi";
      saveData();

      return interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle("✅ KAP KABUL EDİLDİ")
            .setDescription(
              `👤 <@${kap.playerId}>\n` +
              `🏟️ **${kap.buyingTeamName}**\n` +
              `💰 **${formatMoney(kap.salary)}**`
            )
            .setFooter({
              text: "United League • KAP Sistemi"
            })
        ],
        components: []
      });
    }

    // =================================================
    // KAP RED
    // =================================================

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("kap_reject_")
    ) {
      const kapId = interaction.customId.replace("kap_reject_", "");
      const kap = data.kap[kapId];

      if (!kap) {
        return interaction.reply({
          content: "❌ Bu KAP artık geçerli değil.",
          ephemeral: true
        });
      }

      if (interaction.user.id !== kap.playerId) {
        return interaction.reply({
          content: "❌ Bu KAP yalnızca oyuncu tarafından reddedilebilir.",
          ephemeral: true
        });
      }

      kap.status = "redded";
      saveData();

      return interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle("❌ KAP REDDEDİLDİ")
            .setDescription(
              `<@${kap.playerId}> KAP teklifini reddetti.`
            )
            .setFooter({
              text: "United League • KAP Sistemi"
            })
        ],
        components: []
      });
    }

    // =================================================
    // KAP MODAL
    // =================================================

    if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith("kap_modal_")
    ) {
      const kapId = interaction.customId.replace("kap_modal_", "");
      const kap = data.kap[kapId];

      if (!kap) {
        return interaction.reply({
          content: "❌ KAP bulunamadı.",
          ephemeral: true
        });
      }

      const salaryText = interaction.fields.getTextInputValue("salary");
      const salary = parseMoney(salaryText);

      if (salary === null) {
        return interaction.reply({
          content: "❌ Geçerli bir maaş gir.",
          ephemeral: true
        });
      }

      kap.salary = salary;

      saveData();

      return interaction.reply({
        content: `✅ Maaş **${formatMoney(salary)}** olarak güncellendi.`,
        ephemeral: true
      });
    }

  } catch (err) {
    console.error("interactionCreate hatası:", err);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ İşlem sırasında bir hata oluştu.",
        ephemeral: true
      }).catch(() => {});
    }
  }
});

// =====================================================
// KAP KOMUTU
// .kap @oyuncu
// =====================================================

async function kapCommand(message) {
  const target = message.mentions.members.first();

  if (!target) {
    return message.reply(
      "❌ Kullanım: `.kap @oyuncu`"
    );
  }

  // Takım sahibini bul
  const team = Object.values(data.teams).find(
    t =>
      t.ownerId === message.author.id ||
      t.tdId === message.author.id
  );

  if (!team) {
    return message.reply(
      "❌ Bu komutu yalnızca **Teknik Direktör / Takım Sahibi** kullanabilir."
    );
  }

  const kapId =
    `${message.author.id}_${target.id}_${Date.now()}`;

  data.kap[kapId] = {
    id: kapId,
    playerId: target.id,
    buyingTeamId: team.id,
    buyingTeamName: team.name,
    sellerTeamId: null,
    salary: 0,
    playerAccepted: false,
    waitingForTD: false,
    status: "bekliyor",
    createdAt: Date.now()
  };

  saveData();

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("📑 KAP TEKLİFİ")
    .setDescription(
      `**${target}** için yeni bir KAP teklifi oluşturuldu.`
    )
    .addFields(
      {
        name: "👤 Oyuncu",
        value: `${target}`,
        inline: true
      },
      {
        name: "🏟️ Teklif Yapan Takım",
        value: `**${team.name}**`,
        inline: true
      },
      {
        name: "💰 Maaş",
        value: "**Belirlenmedi**",
        inline: true
      }
    )
    .setFooter({
      text: "United League • KAP Sistemi"
    })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`kap_salary_${kapId}`)
      .setLabel("Maaşı Düzenle")
      .setEmoji("💰")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId(`kap_accept_${kapId}`)
      .setLabel("Kabul Et")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId(`kap_reject_${kapId}`)
      .setLabel("Reddet")
      .setEmoji("❌")
      .setStyle(ButtonStyle.Danger)
  );

  await message.channel.send({
    content: `${target}`,
    embeds: [embed],
    components: [row],
    allowedMentions: {
      users: [target.id]
    }
  });
}

// =====================================================
// DEĞER KOMUTU
// .dver @oyuncu 5m
// .değer @oyuncu
// .değer sil @oyuncu 5m
// =====================================================

async function valueCommand(message, args) {
  if (!isValueStaff(message.member)) {
    return message.reply(
      "❌ Bu komutu yalnızca **Değer Yetkilisi** kullanabilir."
    );
  }

  const removeMode =
    args[0]?.toLowerCase() === "sil";

  let target;
  let amountText;

  if (removeMode) {
    target = message.mentions.members.first();
    amountText = args[2];
  } else {
    target = message.mentions.members.first();
    amountText = args[1];
  }

  if (!target) {
    return message.reply(
      "❌ Kullanım: `.dver @oyuncu 5m`"
    );
  }

  if (!amountText) {
    return message.reply(
      "❌ Miktar belirtmelisin. Örnek: `5m`"
    );
  }

  const amount = parseMoney(amountText);

  if (amount === null) {
    return message.reply(
      "❌ Geçerli bir miktar gir. Örnek: `5m`, `500k`, `1000000`"
    );
  }

  const result = await changePlayerValue(
    target,
    removeMode ? -amount : amount
  );

  const embed = new EmbedBuilder()
    .setColor(removeMode ? 0xe74c3c : 0x2ecc71)
    .setTitle(
      removeMode
        ? "💸 OYUNCU DEĞERİ AZALTILDI"
        : "💰 OYUNCU DEĞERİ GÜNCELLENDİ"
    )
    .setDescription(
      `👤 **Oyuncu:** ${target}\n` +
      `📊 **Eski Değer:** ${formatMoney(result.oldValue)}\n` +
      `🔄 **İşlem:** ${removeMode ? "-" : "+"}${formatMoney(amount)}\n` +
      `💰 **Yeni Değer:** ${formatMoney(result.newValue)}`
    )
    .setFooter({
      text: "United League • Değer Sistemi"
    })
    .setTimestamp();

  await message.reply({
    embeds: [embed]
  });
}

// =====================================================
// PING
// =====================================================

async function pingCommand(message) {
  const sent = await message.reply("🏓 Ping ölçülüyor...");

  const roundtrip =
    sent.createdTimestamp - message.createdTimestamp;

  await sent.edit(
    `🏓 **Pong!**\n` +
    `💻 WebSocket: **${client.ws.ping}ms**\n` +
    `📡 Roundtrip: **${roundtrip}ms**`
  );
}

// =====================================================
// SAATLİK DURUM
// =====================================================

let lastStatusHour = null;

function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  return `${days}g ${hours}s ${minutes}dk`;
}

async function sendHourlyStatus() {
  try {
    const now = new Date();

    const hour = now.getHours();

    if (now.getMinutes() !== 0) return;

    const hourKey =
      `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${hour}`;

    if (lastStatusHour === hourKey) return;

    lastStatusHour = hourKey;

    const channel = await client.channels
      .fetch(ANNOUNCEMENT_CHANNEL_ID)
      .catch(() => null);

    if (!channel || !channel.isTextBased()) return;

    let guildCount = client.guilds.cache.size;

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("🤖 UNITED LEAGUE • BOT DURUMU")
      .addFields(
        {
          name: "🟢 Durum",
          value: "Aktif ve çalışıyor",
          inline: true
        },
        {
          name: "🏓 Ping",
          value: `${client.ws.ping}ms`,
          inline: true
        },
        {
          name: "🌐 Sunucu",
          value: `${guildCount}`,
          inline: true
        },
        {
          name: "⏱️ Çalışma Süresi",
          value: formatUptime(client.uptime),
          inline: true
        }
      )
      .setDescription(
        "⚽ **United League | Futbol RP**\n\n" +
        "🛠️ Tüm sistemler aktif ve çalışıyor."
      )
      .setFooter({
        text: "United League • Bot Durumu"
      })
      .setTimestamp();

    await channel.send({
      embeds: [embed]
    });

  } catch (err) {
    console.error("Saatlik durum hatası:", err);
  }
}

// =====================================================
// MESAJ KOMUTLARI
// =====================================================

client.on("messageCreate", async message => {
  try {
    if (message.author.bot) return;
    if (!message.guild) return;

    if (!message.content.startsWith(".")) return;

    const args = message.content
      .slice(1)
      .trim()
      .split(/\s+/);

    const command = args.shift()?.toLowerCase();

    if (!command) return;

    switch (command) {

      // KAYIT
      case "k":
      case "kayıt":
        await registrationCommand(message, args);
        break;

      // KAP
      case "kap":
        await kapCommand(message);
        break;

      // DEĞER
      case "dver":
        await valueCommand(message, args);
        break;

      case "değer":
        if (args[0]?.toLowerCase() === "sil") {
          await valueCommand(message, args);
        } else {
          const target = message.mentions.members.first();

          if (!target) {
            return message.reply(
              "❌ Kullanım: `.değer @oyuncu`"
            );
          }

          const value =
            getNicknameValue(
              target.nickname || target.user.username
            );

          return message.reply(
            `💰 **${target.displayName}** değeri: **${formatMoney(value)}**`
          );
        }
        break;

      // PING
      case "ping":
        await pingCommand(message);
        break;

      default:
        break;
    }

  } catch (err) {
    console.error("messageCreate hatası:", err);

    await message.reply(
      "❌ Komut çalıştırılırken bir hata oluştu."
    ).catch(() => {});
  }
});

// =====================================================
// BOT HAZIR
// =====================================================

client.once("ready", async () => {
  console.log("====================================");
  console.log(`🤖 ${client.user.tag} aktif!`);
  console.log(`🌐 ${client.guilds.cache.size} sunucu`);
  console.log("====================================");

  client.user.setPresence({
    activities: [
      {
        name: BOT_ACTIVITY,
        type: ActivityType.Playing
      }
    ],
    status: "online"
  });

  // Saatlik kontrol
  setInterval(sendHourlyStatus, 20000);
});

// =====================================================
// LOGIN
// =====================================================

if (!TOKEN) {
  console.error(
    "❌ TOKEN bulunamadı! Railway/Rainway Variables kısmına TOKEN ekle."
  );
  process.exit(1);
}

client.login(TOKEN);
