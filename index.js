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
  ChannelType,
  ActivityType
} = require("discord.js");

const fs = require("fs");
const path = require("path");

// ==============================
// TOKEN
// ==============================

const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.error(
    "❌ TOKEN bulunamadı. Railway > Variables kısmına TOKEN ekle."
  );
  process.exit(1);
}

// ==============================
// ROL ID'LERİ
// ==============================

const IDS = {
  ADMIN: "1544449436011339806",
  REGISTER: "1544452022764568656",
  VALUE: "1544451743746891806"
};

// ==============================
// DOSYA
// ==============================

const DATA_FILE = path.join(__dirname, "data.json");

// ==============================
// PING ROLLERİ
// BOT OTOMATİK OLUŞTURUR
// ==============================

const PING_ROLES = [
  "⚽ Maç Ping",
  "📢 Duyuru Ping",
  "🎉 Etkinlik Ping",
  "📰 Haber Ping",
  "🔄 Transfer Ping"
];

// ==============================
// DESTEK TÜRLERİ
// ==============================

const TICKET_TYPES = {
  genel: "📝 Genel Destek",
  teknik: "⚙️ Teknik Destek",
  yonetim: "👑 Yönetim Desteği"
};

// ==============================
// VARSAYILAN VERİ
// ==============================

const DEFAULT_DATA = {
  players: {},
  teams: {},
  matches: [],
  giveaways: {},
  tickets: {},
  guilds: {}
};

function cloneDefault() {
  return JSON.parse(JSON.stringify(DEFAULT_DATA));
}

// ==============================
// VERİ YÜKLE
// ==============================

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(DEFAULT_DATA, null, 2)
      );
    }

    const data = JSON.parse(
      fs.readFileSync(DATA_FILE, "utf8")
    );

    return {
      ...cloneDefault(),
      ...data
    };
  } catch (error) {
    console.error("❌ data.json okunamadı:", error);
    return cloneDefault();
  }
}

let db = loadData();

// ==============================
// VERİ KAYDET
// ==============================

function saveData() {
  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(db, null, 2)
    );
  } catch (error) {
    console.error("❌ Veriler kaydedilemedi:", error);
  }
}

// ==============================
// PARA SİSTEMİ
// ==============================

function moneyToNumber(input) {
  if (!input) return NaN;

  const value = String(input)
    .trim()
    .toUpperCase()
    .replace(/€/g, "")
    .replace(/\s/g, "")
    .replace(",", ".");

  const match = value.match(
    /^([0-9]+(?:\.[0-9]+)?)(K|M|B)?$/
  );

  if (!match) return NaN;

  const number = Number(match[1]);

  const multiplier = {
    K: 1_000,
    M: 1_000_000,
    B: 1_000_000_000
  };

  return number * (multiplier[match[2]] || 1);
}

function formatMoney(number) {
  number = Math.max(
    0,
    Math.round(Number(number) || 0)
  );

  if (number >= 1_000_000_000) {
    return (
      (number / 1_000_000_000)
        .toFixed(number % 1_000_000_000 === 0 ? 0 : 2)
        .replace(/\.00$/, "") + "B€"
    );
  }

  if (number >= 1_000_000) {
    return (
      (number / 1_000_000)
        .toFixed(number % 1_000_000 === 0 ? 0 : 2)
        .replace(/\.00$/, "") + "M€"
    );
  }

  if (number >= 1_000) {
    return (
      (number / 1_000)
        .toFixed(number % 1_000 === 0 ? 0 : 1)
        .replace(/\.0$/, "") + "K€"
    );
  }

  return `${number}€`;
}

// ==============================
// YETKİ SİSTEMİ
// ==============================

function hasRole(member, roleId) {
  return Boolean(
    member?.roles?.cache?.has(roleId)
  );
}

function isAdmin(member) {
  return Boolean(
    member?.permissions?.has(
      PermissionsBitField.Flags.Administrator
    ) || hasRole(member, IDS.ADMIN)
  );
}

function canValue(member) {
  return (
    isAdmin(member) ||
    hasRole(member, IDS.VALUE)
  );
}

function canRegister(member) {
  return (
    isAdmin(member) ||
    hasRole(member, IDS.REGISTER)
  );
}

// Kayıtlı olmayan diğer yetkilerin hepsi Yönetici.
// Maç, çekiliş, medya, DM/SM, mute, kick,
// kanal kilitleme/açma vb. Yönetici tarafından kullanılır.

// ==============================
// OYUNCU
// ==============================

function getPlayer(userId) {
  if (!db.players[userId]) {
    db.players[userId] = {
      value: 0,
      training: 0,
      goals: 0,
      assists: 0,
      teamId: null
    };
  }

  return db.players[userId];
}

// ==============================
// TAKIM
// ==============================

function teamByRoleId(roleId) {
  return Object.values(db.teams).find(
    team => team.roleId === roleId
  );
}

function teamByName(name) {
  return Object.values(db.teams).find(
    team =>
      team.name.toLowerCase() ===
      name.toLowerCase()
  );
}

// ==============================
// SÜRE
// ==============================

function parseDuration(input) {
  const match = String(input || "")
    .toLowerCase()
    .match(/^(\d+(?:\.\d+)?)(s|m|h|d)$/);

  if (!match) return NaN;

  const number = Number(match[1]);

  const multiplier = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };

  return number * multiplier[match[2]];
}

// ==============================
// İSİM TEMİZLEME
// ==============================

function safeName(name) {
  return (
    String(name)
      .toLowerCase()
      .replace(
        /[^a-z0-9ğüşöçıİĞÜŞÖÇ_-]/gi,
        "-"
      )
      .slice(0, 80) || "kullanici"
  );
}

// ==============================
// CLIENT
// ==============================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],

  partials: [
    Partials.Channel,
    Partials.Message
  ]
});

// ==============================
// PING ROLLERİNİ OLUŞTUR
// ==============================

async function ensurePingRoles(guild) {
  const roles = {};

  for (const roleName of PING_ROLES) {
    let role = guild.roles.cache.find(
      r => r.name === roleName
    );

    if (!role) {
      role = await guild.roles
        .create({
          name: roleName,
          reason: "Futbol RP ping sistemi"
        })
        .catch(() => null);
    }

    if (role) {
      roles[roleName] = role.id;
    }
  }

  db.guilds[guild.id] = {
    ...(db.guilds[guild.id] || {}),
    pingRoles: roles
  };

  saveData();
}

// ==============================
// YARDIM EMBED
// ==============================

function helpEmbed() {
  return new EmbedBuilder()
    .setTitle("⚽ Futbol RP Bot")
    .setDescription(
      [
        "**👤 Oyuncu**",
        "`.profil`",
        "`.istatistik`",
        "`.gol @oyuncu`",
        "`.asist @oyuncu`",
        "`.antrenman` / `.ant`",
        "`.pen` / `.penaltı`",
        "",
        "**💰 Değer**",
        "`.dver @oyuncu 5M`",
        "",
        "**🏟️ Takım**",
        "`.takımoluştur Takım Adı`",
        "`.kadro @takım`",
        "`.transfer @oyuncu @takım`",
        "",
        "**🏆 Müze**",
        "`.müze @takım`",
        "`.kupaekle @takım Kupa Adı`",
        "`.kupasil @takım Kupa Adı`",
        "",
        "**⚽ Lig**",
        "`.maç @takım1 @takım2`",
        "`.puan`",
        "`.fikstur`",
        "`.macsonuclari`",
        "`.golkral`",
        "`.asistkral`",
        "",
        "**🎫 Destek**",
        "`.destekpanel`",
        "",
        "**🔔 Roller**",
        "`.rolpanel`",
        "",
        "**🎉 Çekiliş**",
        "`.çekiliş 5M€ 5m`",
        "",
        "**🛡️ Yönetim**",
        "`.k @oyuncu İsim`",
        "`.embed Mesaj`",
        "`.sil 100`",
        "`.mute @oyuncu`",
        "`.unmute @oyuncu`",
        "`.kick @oyuncu`",
        "`.kilitle`",
        "`.kilitac`"
      ].join("\n")
    );
}

// ==============================
// BOT READY
// ==============================

client.once("ready", async () => {
  console.log(
    `✅ ${client.user.tag} aktif!`
  );

  client.user.setActivity(
    "⚽ Futbol RP",
    {
      type: ActivityType.Playing
    }
  );

  for (const guild of client.guilds.cache.values()) {
    await ensurePingRoles(guild).catch(
      console.error
    );
  }

  setInterval(
    ticketWatcher,
    60 * 1000
  );

  for (const giveaway of Object.values(
    db.giveaways
  )) {
    scheduleGiveaway(giveaway);
  }
});

// ==============================
// YENİ SUNUCU
// ==============================

client.on("guildCreate", guild => {
  ensurePingRoles(guild).catch(console.error);
});

// ==============================
// TICKET OTOMATİK KAPATMA
// 60 DK MESAJ YOKSA
// ==============================

async function ticketWatcher() {
  const now = Date.now();

  for (const [userId, ticket] of Object.entries(
    db.tickets
  )) {
    if (!ticket.channelId) continue;

    if (
      now - ticket.lastMessage >=
      60 * 60 * 1000
    ) {
      const channel =
        client.channels.cache.get(
          ticket.channelId
        );

      if (channel) {
        await channel
          .send(
            "⏰ Bu ticketta 60 dakikadır mesaj yok. Ticket kapatılıyor."
          )
          .catch(() => {});

        await channel
          .delete()
          .catch(() => {});
      }

      delete db.tickets[userId];
      saveData();
    }
  }
}

// ==============================
// ÇEKİLİŞ ZAMANLAYICI
// ==============================

function scheduleGiveaway(giveaway) {
  if (giveaway.finished) return;

  const remaining =
    giveaway.endsAt - Date.now();

  if (remaining <= 0) {
    finishGiveaway(giveaway.id);
    return;
  }

  setTimeout(() => {
    finishGiveaway(giveaway.id);
  }, Math.min(remaining, 2_147_483_647));
}

// ==============================
// ÇEKİLİŞ BİTİR
// ==============================

async function finishGiveaway(id) {
  const giveaway = db.giveaways[id];

  if (!giveaway || giveaway.finished) {
    return;
  }

  giveaway.finished = true;

  const channel =
    client.channels.cache.get(
      giveaway.channelId
    );

  const entries = [
    ...new Set(giveaway.entries || [])
  ];

  let winner = null;

  if (entries.length > 0) {
    winner =
      entries[
        Math.floor(
          Math.random() * entries.length
        )
      ];
  }

  if (channel) {
    await channel
      .send(
        [
          "🎉 **ÇEKİLİŞ BİTTİ!**",
          "",
          `🎁 Ödül: **${giveaway.prize}**`,
          winner
            ? `🏆 Kazanan: <@${winner}>`
            : "❌ Katılımcı olmadığı için kazanan yok."
        ].join("\n")
      )
      .catch(() => {});
  }

  saveData();
}

// ==============================
// INTERACTION
// ==============================

client.on(
  "interactionCreate",
  async interaction => {
    try {
      // ==========================
      // BUTONLAR
      // ==========================

      if (interaction.isButton()) {

        // PING ROLLERİ
        if (
          interaction.customId.startsWith(
            "ping:"
          )
        ) {
          const roleId =
            interaction.customId.split(":")[1];

          const role =
            interaction.guild.roles.cache.get(
              roleId
            );

          if (!role) {
            return interaction.reply({
              content:
                "❌ Rol bulunamadı.",
              ephemeral: true
            });
          }

          if (
            interaction.member.roles.cache.has(
              role.id
            )
          ) {
            await interaction.member.roles.remove(
              role
            );

            return interaction.reply({
              content:
                `🔕 ${role.name} kaldırıldı.`,
              ephemeral: true
            });
          }

          await interaction.member.roles.add(
            role
          );

          return interaction.reply({
            content:
              `🔔 ${role.name} verildi.`,
            ephemeral: true
          });
        }

        // TICKET KAPAT
        if (
          interaction.customId ===
          "ticket:close"
        ) {
          const found = Object.entries(
            db.tickets
          ).find(
            ([, ticket]) =>
              ticket.channelId ===
              interaction.channelId
          );

          if (!found) {
            return interaction.reply({
              content:
                "❌ Ticket kaydı bulunamadı.",
              ephemeral: true
            });
          }

          await interaction.reply(
            "🔒 Ticket kapatılıyor..."
          );

          delete db.tickets[found[0]];
          saveData();

          setTimeout(() => {
            interaction.channel
              .delete()
              .catch(() => {});
          }, 1500);

          return;
        }

        // ÇEKİLİŞ KATIL
        if (
          interaction.customId.startsWith(
            "giveaway:"
          )
        ) {
          const id =
            interaction.customId.split(":")[1];

          const giveaway =
            db.giveaways[id];

          if (
            !giveaway ||
            giveaway.finished
          ) {
            return interaction.reply({
              content:
                "❌ Bu çekiliş bitmiş.",
              ephemeral: true
            });
          }

          if (
            giveaway.entries.includes(
              interaction.user.id
            )
          ) {
            return interaction.reply({
              content:
                "❌ Zaten çekilişe katıldın.",
              ephemeral: true
            });
          }

          giveaway.entries.push(
            interaction.user.id
          );

          saveData();

          return interaction.reply({
            content:
              "🎉 Çekilişe katıldın!",
            ephemeral: true
          });
        }
      }

      // ==========================
      // TICKET SELECT MENU
      // ==========================

      if (
        interaction.isStringSelectMenu() &&
        interaction.customId ===
          "ticket:type"
      ) {
        const existing =
          Object.values(db.tickets).find(
            ticket =>
              ticket.userId ===
                interaction.user.id &&
              ticket.guildId ===
                interaction.guildId
          );

        if (existing) {
          return interaction.reply({
            content:
              `❌ Zaten açık ticketın var: <#${existing.channelId}>`,
            ephemeral: true
          });
        }

        const type =
          interaction.values[0];

        const channelName =
          `ticket-${safeName(
            interaction.user.username
          )}`;

        const channel =
          await interaction.guild.channels.create(
            {
              name: channelName,
              type: ChannelType.GuildText,

              permissionOverwrites: [
                {
                  id: interaction.guild.roles
                    .everyone.id,

                  deny: [
                    PermissionsBitField.Flags
                      .ViewChannel
                  ]
                },

                {
                  id: interaction.user.id,

                  allow: [
                    PermissionsBitField.Flags
                      .ViewChannel,

                    PermissionsBitField.Flags
                      .SendMessages,

                    PermissionsBitField.Flags
                      .ReadMessageHistory
                  ]
                }
              ]
            }
          );

        const adminRole =
          interaction.guild.roles.cache.get(
            IDS.ADMIN
          );

        if (adminRole) {
          await channel.permissionOverwrites
            .create(adminRole, {
              ViewChannel: true,
              SendMessages: true,
              ReadMessageHistory: true
            })
            .catch(() => {});
        }

        db.tickets[
          interaction.user.id
        ] = {
          userId: interaction.user.id,
          guildId: interaction.guildId,
          channelId: channel.id,
          lastMessage: Date.now(),
          type
        };

        saveData();

        const embed =
          new EmbedBuilder()
            .setTitle(
              TICKET_TYPES[type]
            )
            .setDescription(
              [
                "🎫 Destek talebin oluşturuldu.",
                "",
                "Yetkili en kısa sürede yardımcı olacaktır.",
                "",
                "Ticketı kapatmak için aşağıdaki butona bas."
              ].join("\n")
            );

        const closeButton =
          new ButtonBuilder()
            .setCustomId(
              "ticket:close"
            )
            .setLabel("Ticket Kapat")
            .setEmoji("🔒")
            .setStyle(
              ButtonStyle.Danger
            );

        await channel.send({
          content:
            `<@${interaction.user.id}>`,
          embeds: [embed],
          components: [
            new ActionRowBuilder().addComponents(
              closeButton
            )
          ]
        });

        return interaction.reply({
          content:
            `✅ Ticket oluşturuldu: <#${channel.id}>`,
          ephemeral: true
        });
      }

    } catch (error) {
      console.error(
        "❌ Interaction hatası:",
        error
      );

      if (!interaction.replied) {
        interaction
          .reply({
            content:
              "❌ İşlem sırasında hata oluştu.",
            ephemeral: true
          })
          .catch(() => {});
      }
    }
  }
);

// ==============================
// MESAJ SİSTEMİ
// ==============================

client.on(
  "messageCreate",
  async message => {

    if (
      !message.guild ||
      message.author.bot
    ) {
      return;
    }

    // Ticket mesaj zamanını yenile
    const ticket =
      Object.values(db.tickets).find(
        t =>
          t.channelId ===
          message.channelId
      );

    if (ticket) {
      ticket.lastMessage =
        Date.now();

      saveData();
    }

    if (
      !message.content.startsWith(".")
    ) {
      return;
    }

    const raw =
      message.content
        .slice(1)
        .trim();

    if (!raw) return;

    const [
      commandRaw,
      ...args
    ] = raw.split(/\s+/);

    const command =
      commandRaw.toLowerCase();

    const reply = (
      content,
      options = {}
    ) =>
      message.reply({
        content,
        ...options
      }).catch(() => {});

    const sendEmbed = (
      embed,
      components
    ) =>
      message.channel.send({
        embeds: [embed],
        ...(components
          ? { components }
          : {})
      }).catch(() => {});

    try {

      // ==========================
      // YARDIM
      // ==========================

      if (
        command === "yardım" ||
        command === "help"
      ) {
        return sendEmbed(
          helpEmbed()
        );
      }

      // ==========================
      // ROL PANEL
      // ==========================

      if (
        command === "rolpanel"
      ) {
        await ensurePingRoles(
          message.guild
        );

        const roles =
          db.guilds[
            message.guild.id
          ]?.pingRoles || {};

        const embed =
          new EmbedBuilder()
            .setTitle(
              "🔔 Bildirim Rolleri"
            )
            .setDescription(
              "İstediğin bildirim rollerini butonlardan alabilir veya kaldırabilirsin."
            );

        const row =
          new ActionRowBuilder();

        for (
          const roleName of PING_ROLES
        ) {
          const roleId =
            roles[roleName];

          if (!roleId) continue;

          row.addComponents(
            new ButtonBuilder()
              .setCustomId(
                `ping:${roleId}`
              )
              .setLabel(
                roleName.substring(3)
              )
              .setStyle(
                ButtonStyle.Secondary
              )
          );
        }

        return sendEmbed(
          embed,
          [row]
        );
      }

      // ==========================
      // DESTEK PANEL
      // ==========================

      if (
        command ===
        "destekpanel"
      ) {
        if (
          !isAdmin(
            message.member
          )
        ) {
          return reply(
            "❌ Bu komut sadece Yönetici içindir."
          );
        }

        const embed =
          new EmbedBuilder()
            .setTitle(
              "🎫 Destek Merkezi"
            )
            .setDescription(
              [
                "Yardıma mı ihtiyacın var?",
                "",
                "Aşağıdaki menüden destek türünü seç."
              ].join("\n")
            );

        const menu =
          new StringSelectMenuBuilder()
            .setCustomId(
              "ticket:type"
            )
            .setPlaceholder(
              "Destek türünü seç"
            )
            .addOptions(
              Object.entries(
                TICKET_TYPES
              ).map(
                ([value, label]) => ({
                  label,
                  value
                })
              )
            );

        return sendEmbed(
          embed,
          [
            new ActionRowBuilder().addComponents(
              menu
            )
          ]
        );
      }

      // ==========================
      // PROFİL
      // ==========================

      if (
        command === "profil"
      ) {
        const player =
          getPlayer(
            message.author.id
          );

        const team =
          player.teamId &&
          db.teams[player.teamId]
            ? db.teams[
                player.teamId
              ].name
            : "Yok";

        const embed =
          new EmbedBuilder()
            .setTitle(
              `👤 ${message.author.username}`
            )
            .addFields(
              {
                name: "💰 Değer",
                value:
                  formatMoney(
                    player.value
                  ),
                inline: true
              },
              {
                name: "⚽ Gol",
                value:
                  String(
                    player.goals
                  ),
                inline: true
              },
              {
                name: "🎯 Asist",
                value:
                  String(
                    player.assists
                  ),
                inline: true
              },
              {
                name: "🏋️ Antrenman",
                value:
                  `${player.training}/10`,
                inline: true
              },
              {
                name: "🏟️ Takım",
                value: team,
                inline: true
              }
            );

        return sendEmbed(
          embed
        );
      }

      // ==========================
      // GOL EKLE
      // ==========================

      if (
        command === "gol" ||
        command === "asist"
      ) {
        if (
          !isAdmin(
            message.member
          )
        ) {
          return reply(
            "❌ Bu komut sadece Yönetici içindir."
          );
        }

        const user =
          message.mentions.users.first();

        if (!user) {
          return reply(
            `Kullanım: .${command} @oyuncu`
          );
        }

        const player =
          getPlayer(user.id);

        if (
          command === "gol"
        ) {
          player.goals++;
        } else {
          player.assists++;
        }

        saveData();

        return reply(
          `✅ ${user} için 1 ${
            command === "gol"
              ? "gol"
              : "asist"
          } eklendi.`
        );
      }

      // ==========================
      // ANTRENMAN
      // ==========================

      if (
        command === "antrenman" ||
        command === "ant"
      ) {
        const player =
          getPlayer(
            message.author.id
          );

        player.training++;

        if (
          player.training >= 10
        ) {
          player.training = 0;
          player.value += 3_000_000;

          saveData();

          return reply(
            [
              "🏋️ **ANTRENMAN TAMAMLANDI!**",
              "",
              "📊 İlerleme: **10/10**",
              "💰 Ödül: **+3M€**",
              `💵 Yeni değer: **${formatMoney(
                player.value
              )}**`
            ].join("\n")
          );
        }

        saveData();

        return reply(
          `🏋️ Antrenman ilerlemesi: **${player.training}/10**`
        );
      }

      // ==========================
      // PENALTI
      // ==========================

      if (
        command === "pen" ||
        command === "penaltı" ||
        command === "penalti"
      ) {
        const player =
          getPlayer(
            message.author.id
          );

        const scored =
          Math.random() < 0.7;

        if (scored) {
          player.goals++;
          player.value += 2_000_000;

          saveData();

          return reply(
            [
              "⚽ **GOOOOL!**",
              "",
              "💰 +2M€",
              `💵 Yeni değer: **${formatMoney(
                player.value
              )}**`
            ].join("\n")
          );
        }

        return reply(
          "🧤 **KALECİ KURTARDI!**"
        );
      }

      // ==========================
      // DEĞER VER
      // ==========================

      if (
        command === "dver"
      ) {
        if (
          !canValue(
            message.member
          )
        ) {
          return reply(
            "❌ Bu komut için Değer Yetkilisi veya Yönetici olmalısın."
          );
        }

        const member =
          message.mentions.members.first();

        const amountText =
          args.find(
            value =>
              !value.startsWith(
                "<@"
              )
          );

        const amount =
          moneyToNumber(
            amountText
          );

        if (
          !member ||
          !Number.isFinite(amount) ||
          amount <= 0
        ) {
          return reply(
            "Kullanım: `.dver @oyuncu 5M`"
          );
        }

        const player =
          getPlayer(
            member.id
          );

        player.value += amount;

        const oldNickname =
          member.displayName;

        let base =
          oldNickname.replace(
            /\s*\|\s*\d+(?:[.,]\d+)?(?:K|M|B)?€?\s*$/i,
            ""
          );

        if (!base.trim()) {
          base =
            member.user.username;
        }

        const newNickname =
          `${base} | ${formatMoney(
            player.value
          )}`.slice(0, 32);

        await member
          .setNickname(
            newNickname
          )
          .catch(() => {});

        saveData();

        return reply(
          [
            `💰 ${member} değerine **${formatMoney(
              amount
            )}** eklendi.`,
            `💵 Yeni değer: **${formatMoney(
              player.value
            )}**`
          ].join("\n")
        );
      }

      // ==========================
      // KAYIT
      // ==========================

      if (
        command === "k"
      ) {
        if (
          !canRegister(
            message.member
          )
        ) {
          return reply(
            "❌ Bu komut Kayıt Yetkilisi veya Yönetici içindir."
          );
        }

        const member =
          message.mentions.members.first();

        const name =
          args.slice(1).join(" ");

        if (
          !member ||
          !name
        ) {
          return reply(
            "Kullanım: `.k @oyuncu İsim`"
          );
        }

        const player =
          getPlayer(
            member.id
          );

        const nickname =
          `${name} | ${formatMoney(
            player.value
          )}`.slice(0, 32);

        await member
          .setNickname(
            nickname
          )
          .catch(() => {});

        saveData();

        return reply(
          `✅ ${member} başarıyla kayıt edildi.`
        );
      }

      // ==========================
      // TD
      // ==========================

      if (
        command === "td"
      ) {
        if (
          !canRegister(
            message.member
          )
        ) {
          return reply(
            "❌ Bu komut Kayıt Yetkilisi veya Yönetici içindir."
          );
        }

        const member =
          message.mentions.members.first();

        if (!member) {
          return reply(
            "Kullanım: `.td @oyuncu`"
          );
        }

        return reply(
          `👔 ${member} Teknik Direktör işlemi için seçildi.`
        );
      }

      // ==========================
      // TAKIM OLUŞTUR
      // ==========================

      if (
        command ===
          "takımoluştur" ||
        command ===
          "takimolustur"
      ) {
        if (
          !isAdmin(
            message.member
          )
        ) {
          return reply(
            "❌ Bu komut sadece Yönetici içindir."
          );
        }

        const name =
          args.join(" ");

        if (!name) {
          return reply(
            "Kullanım: `.takımoluştur Takım Adı`"
          );
        }

        if (
          teamByName(name)
        ) {
          return reply(
            "❌ Bu takım zaten var."
          );
        }

        const role =
          await message.guild.roles
            .create({
              name,
              reason:
                "Futbol RP takım rolü"
            })
            .catch(() => null);

        if (!role) {
          return reply(
            "❌ Takım rolü oluşturulamadı. Botun Rolleri Yönet yetkisini kontrol et."
          );
        }

        const id =
          `${Date.now()}_${Math.random()
            .toString(36)
            .slice(2, 7)}`;

        db.teams[id] = {
          id,
          name,
          roleId: role.id,
          ownerId:
            message.author.id,
          players: [
            message.author.id
          ],
          budget: 0,
          trophies: [],
          points: 0,
          played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          gf: 0,
          ga: 0
        };

        getPlayer(
          message.author.id
        ).teamId = id;

        await message.member.roles
          .add(role)
          .catch(() => {});

        saveData();

        return reply(
          [
            `✅ **${name}** takımı oluşturuldu!`,
            "",
            `👤 Kurucu: ${message.author}`,
            "🏟️ Takım rolü otomatik oluşturuldu."
          ].join("\n")
        );
      }

      // ==========================
      // KADRO
      // ==========================

      if (
        command === "kadro"
      ) {
        const role =
          message.mentions.roles.first();

        if (!role) {
          return reply(
            "Kullanım: `.kadro @Takım`"
          );
        }

        const team =
          teamByRoleId(
            role.id
          );

        if (!team) {
          return reply(
            "❌ Takım bulunamadı."
          );
        }

        const players =
          team.players.length
            ? team.players
                .map(
                  (id, index) =>
                    `${index + 1}. <@${id}>`
                )
                .join("\n")
            : "Kadrosu boş.";

        return sendEmbed(
          new EmbedBuilder()
            .setTitle(
              `🏟️ ${team.name} Kadrosu`
            )
            .setDescription(
              players
            )
        );
      }

      // ==========================
      // MÜZE
      // ==========================

      if (
        command === "müze" ||
        command === "muze"
      ) {
        const role =
          message.mentions.roles.first();

        if (!role) {
          return reply(
            "Kullanım: `.müze @Takım`"
          );
        }

        const team =
          teamByRoleId(
            role.id
          );

        if (!team) {
          return reply(
            "❌ Takım bulunamadı."
          );
        }

        const trophies =
          team.trophies.length
            ? team.trophies
                .map(
                  trophy =>
                    `🏆 ${trophy}`
                )
                .join("\n")
            : "Henüz kupa kazanılmamış.";

        return sendEmbed(
          new EmbedBuilder()
            .setTitle(
              `🏆 ${team.name} Müzesi`
            )
            .setDescription(
              trophies
            )
        );
      }

      // ==========================
      // KUPA EKLE
      // ==========================

      if (
        command ===
        "kupaekle"
      ) {
        if (
          !isAdmin(
            message.member
          )
        ) {
          return reply(
            "❌ Sadece Yönetici kullanabilir."
          );
        }

        const role =
          message.mentions.roles.first();

        if (!role) {
          return reply(
            "Kullanım: `.kupaekle @Takım Kupa Adı`"
          );
        }

        const team =
          teamByRoleId(
            role.id
          );

        const cup =
          args
            .filter(
              x =>
                !x.includes(
                  role.id
                )
            )
            .join(" ");

        if (
          !team ||
          !cup
        ) {
          return reply(
            "Kullanım: `.kupaekle @Takım Kupa Adı`"
          );
        }

        team.trophies.push(
          cup
        );

        saveData();

        return reply(
          `🏆 **${cup}** kupası **${team.name}** müzesine eklendi.`
        );
      }

      // ==========================
      // KUPA SİL
      // ==========================

      if (
        command ===
        "kupasil"
      ) {
        if (
          !isAdmin(
            message.member
          )
        ) {
          return reply(
            "❌ Sadece Yönetici kullanabilir."
          );
        }

        const role =
          message.mentions.roles.first();

        if (!role) {
          return reply(
            "Kullanım: `.kupasil @Takım Kupa Adı`"
          );
        }

        const team =
          teamByRoleId(
            role.id
          );

        const cup =
          args
            .filter(
              x =>
                !x.includes(
                  role.id
                )
            )
            .join(" ");

        if (
          !team ||
          !cup
        ) {
          return reply(
            "Kullanım: `.kupasil @Takım Kupa Adı`"
          );
        }

        const index =
          team.trophies.findIndex(
            trophy =>
              trophy.toLowerCase() ===
              cup.toLowerCase()
          );

        if (index === -1) {
          return reply(
            "❌ Bu kupa bulunamadı."
          );
        }

        team.trophies.splice(
          index,
          1
        );

        saveData();

        return reply(
          `🗑️ **${cup}** kupası silindi.`
        );
      }

      // ==========================
      // MAÇ
      // ==========================

      if (
        command === "maç" ||
        command === "mac"
      ) {
        if (
          !isAdmin(
            message.member
          )
        ) {
          return reply(
            "❌ Maç başlatmak için Yönetici olmalısın."
          );
        }

        const roles =
          message.mentions.roles
            .first(2);

        if (
          roles.length < 2
        ) {
          return reply(
            "Kullanım: `.maç @Takım1 @Takım2`"
          );
        }

        const home =
          teamByRoleId(
            roles[0].id
          );

        const away =
          teamByRoleId(
            roles[1].id
          );

        if (
          !home ||
          !away
        ) {
          return reply(
            "❌ Takımlardan biri bulunamadı."
          );
        }

        if (
          home.id ===
          away.id
        ) {
          return reply(
            "❌ Aynı takım kendisiyle oynayamaz."
          );
        }

        const matchMessage =
          await message.channel.send(
            `⚽ **${home.name} - ${away.name}** maçı başlıyor...`
          );

        let homeScore = 0;
        let awayScore = 0;

        // Hızlı maç simülasyonu
        // 10-90 dakika arası olaylar
        for (
          let minute = 10;
          minute <= 90;
          minute += 10
        ) {
          await new Promise(
            resolve =>
              setTimeout(
                resolve,
                1000
              )
          );

          const chance =
            Math.random();

          if (
            chance < 0.16
          ) {
            homeScore++;

            const scorer =
              home.players[
                Math.floor(
                  Math.random() *
                    home.players
                      .length
                )
              ];

            if (scorer) {
              getPlayer(
                scorer
              ).goals++;
            }

            await matchMessage
              .edit(
                [
                  `⚽ **${home.name} ${homeScore} - ${awayScore} ${away.name}**`,
                  `⏱️ ${minute}' — ${home.name} gol buldu!`
                ].join("\n")
              )
              .catch(() => {});
          }

          else if (
            chance < 0.32
          ) {
            awayScore++;

            const scorer =
              away.players[
                Math.floor(
                  Math.random() *
                    away.players
                      .length
                )
              ];

            if (scorer) {
              getPlayer(
                scorer
              ).goals++;
            }

            await matchMessage
              .edit(
                [
                  `⚽ **${home.name} ${homeScore} - ${awayScore} ${away.name}**`,
                  `⏱️ ${minute}' — ${away.name} gol buldu!`
                ].join("\n")
              )
              .catch(() => {});
          }
        }

        home.played++;
        away.played++;

        home.gf += homeScore;
        home.ga += awayScore;

        away.gf += awayScore;
        away.ga += homeScore;

        if (
          homeScore >
          awayScore
        ) {
          home.wins++;
          away.losses++;
          home.points += 3;
        }

        else if (
          awayScore >
          homeScore
        ) {
          away.wins++;
          home.losses++;
          away.points += 3;
        }

        else {
          home.draws++;
          away.draws++;
          home.points++;
          away.points++;
        }

        db.matches.push({
          date: Date.now(),
          home:
            home.name,
          away:
            away.name,
          homeScore,
          awayScore
        });

        saveData();

        return matchMessage
          .edit(
            [
              "🏁 **MAÇ SONUCU**",
              "",
              `⚽ **${home.name} ${homeScore} - ${awayScore} ${away.name}**`,
              "",
              "📊 Maç tamamlandı."
            ].join("\n")
          )
          .catch(() => {});
      }

      // ==========================
      // PUAN DURUMU
      // ==========================

      if (
        command === "puan"
      ) {
        const teams =
          Object.values(
            db.teams
          ).sort(
            (a, b) =>
              b.points -
                a.points ||
              (b.gf -
                b.ga) -
                (a.gf -
                  a.ga)
          );

        const text =
          teams.length
            ? teams
                .map(
                  (team, index) =>
                    `**${index + 1}. ${team.name}** — ${team.points} P | ${team.played} O | ${team.wins} G | ${team.draws} B | ${team.losses} M`
                )
                .join("\n")
            : "Henüz takım yok.";

        return sendEmbed(
          new EmbedBuilder()
            .setTitle(
              "📊 Puan Durumu"
            )
            .setDescription(
              text
            )
        );
      }

      // ==========================
      // GOL KRALLIĞI
      // ==========================

      if (
        command === "golkral" ||
        command === "asistkral"
      ) {
        const key =
          command ===
          "golkral"
            ? "goals"
            : "assists";

        const title =
          key === "goals"
            ? "⚽ Gol Krallığı"
            : "🎯 Asist Krallığı";

        const label =
          key === "goals"
            ? "Gol"
            : "Asist";

        const players =
          Object.entries(
            db.players
          )
            .sort(
              ([, a], [, b]) =>
                b[key] -
                a[key]
            )
            .slice(0, 10);

        const text =
          players.length
            ? players
                .map(
                  ([id, player], index) =>
                    `**${index + 1}.** <@${id}> — ${player[key]} ${label}`
                )
                .join("\n")
            : "Henüz istatistik yok.";

        return sendEmbed(
          new EmbedBuilder()
            .setTitle(title)
            .setDescription(
              text
            )
        );
      }

      // ==========================
      // İSTATİSTİK
      // ==========================

      if (
        command ===
        "istatistik"
      ) {
        const player =
          getPlayer(
            message.author.id
          );

        return sendEmbed(
          new EmbedBuilder()
            .setTitle(
              `📈 ${message.author.username}`
            )
            .setDescription(
              [
                `⚽ Gol: **${player.goals}**`,
                `🎯 Asist: **${player.assists}**`,
                `🏋️ Antrenman: **${player.training}/10**`,
                `💰 Değer: **${formatMoney(
                  player.value
                )}**`
              ].join("\n")
            )
        );
      }

      // ==========================
      // FİKSTÜR
      // ==========================

      if (
        command === "fikstur"
      ) {
        const matches =
          db.matches
            .slice(-10)
            .reverse();

        const text =
          matches.length
            ? matches
                .map(
                  match =>
                    `⚽ ${match.home} **${match.homeScore}-${match.awayScore}** ${match.away}`
                )
                .join("\n")
            : "Henüz maç yok.";

        return sendEmbed(
          new EmbedBuilder()
            .setTitle(
              "📅 Fikstür"
            )
            .setDescription(
              text
            )
        );
      }

      // ==========================
      // MAÇ SONUÇLARI
      // ==========================

      if (
        command ===
        "macsonuclari"
      ) {
        const matches =
          db.matches
            .slice(-15)
            .reverse();

        const text =
          matches.length
            ? matches
                .map(
                  match =>
                    `🏁 ${match.home} **${match.homeScore}-${match.awayScore}** ${match.away}`
                )
                .join("\n")
            : "Henüz maç sonucu yok.";

        return sendEmbed(
          new EmbedBuilder()
            .setTitle(
              "🏁 Maç Sonuçları"
            )
            .setDescription(
              text
            )
        );
      }

      // ==========================
      // TRANSFER
      // ==========================

      if (
        command ===
        "transfer"
      ) {
        if (
          !isAdmin(
            message.member
          )
        ) {
          return reply(
            "❌ Sadece Yönetici kullanabilir."
          );
        }

        const member =
          message.mentions.members.first();

        const role =
          message.mentions.roles.first();

        if (
          !member ||
          !role
        ) {
          return reply(
            "Kullanım: `.transfer @oyuncu @Takım`"
          );
        }

        const team =
          teamByRoleId(
            role.id
          );

        if (!team) {
          return reply(
            "❌ Takım bulunamadı."
          );
        }

        for (
          const oldTeam of Object.values(
            db.teams
          )
        ) {
          oldTeam.players =
            oldTeam.players.filter(
              id =>
                id !==
                member.id
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

        getPlayer(
          member.id
        ).teamId = team.id;

        await member.roles
          .add(role)
          .catch(() => {});

        saveData();

        return reply(
          `🔄 ${member} **${team.name}** takımına transfer edildi.`
        );
      }

      // ==========================
      // ÇEKİLİŞ
      // ==========================

      if (
        command ===
          "çekiliş" ||
        command ===
          "cekilis"
      ) {
        if (
          !isAdmin(
            message.member
          )
        ) {
          return reply(
            "❌ Sadece Yönetici kullanabilir."
          );
        }

        const prize =
          args[0];

        const duration =
          parseDuration(
            args[1]
          );

        if (
          !prize ||
          !Number.isFinite(
            duration
          )
        ) {
          return reply(
            "Kullanım: `.çekiliş 5M€ 5m`"
          );
        }

        const id =
          `${Date.now()}`;

        const giveaway = {
          id,
          prize,
          channelId:
            message.channelId,
          endsAt:
            Date.now() +
            duration,
          entries: [],
          finished: false
        };

        db.giveaways[id] =
          giveaway;

        saveData();
        scheduleGiveaway(
          giveaway
        );

        const embed =
          new EmbedBuilder()
            .setTitle(
              "🎉 ÇEKİLİŞ"
            )
            .setDescription(
              [
                `🎁 Ödül: **${prize}**`,
                `⏰ Süre: **${args[1]}**`,
                "",
                "Katılmak için aşağıdaki butona bas!"
              ].join("\n")
            );

        const button =
          new ButtonBuilder()
            .setCustomId(
              `giveaway:${id}`
            )
            .setLabel("Katıl")
            .setEmoji("🎉")
            .setStyle(
              ButtonStyle.Success
            );

        return sendEmbed(
          embed,
          [
            new ActionRowBuilder().addComponents(
              button
            )
          ]
        );
      }

      // ==========================
      // EMBED
      // ==========================

      if (
        command === "embed"
      ) {
        if (
          !isAdmin(
            message.member
          )
        ) {
          return reply(
            "❌ Sadece Yönetici kullanabilir."
          );
        }

        const text =
          args.join(" ");

        if (!text) {
          return reply(
            "Kullanım: `.embed Mesaj`"
          );
        }

        await message
          .delete()
          .catch(() => {});

        return sendEmbed(
          new EmbedBuilder()
            .setDescription(
              text
            )
        );
      }

      // ==========================
      // MESAJ SİL
      // 1-1000
      // ==========================

      if (
        command === "sil"
      ) {
        if (
          !isAdmin(
            message.member
          )
        ) {
          return reply(
            "❌ Sadece Yönetici kullanabilir."
          );
        }

        let amount =
          Number(
            args[0]
          );

        if (
          !Number.isInteger(
            amount
          ) ||
          amount < 1 ||
          amount > 1000
        ) {
          return reply(
            "❌ 1-1000 arasında bir sayı gir."
          );
        }

        let deleted = 0;

        while (
          amount > 0
        ) {
          const batch =
            Math.min(
              amount,
              100
            );

          const messages =
            await message.channel.bulkDelete(
              batch,
              true
            ).catch(
              () => null
            );

          if (
            !messages ||
            messages.size === 0
          ) {
            break;
          }

          deleted +=
            messages.size;

          amount -=
            messages.size;

          if (
            messages.size <
            batch
          ) {
            break;
          }
        }

        const info =
          await message.channel
            .send(
              `🗑️ **${deleted}** mesaj silindi.`
            )
            .catch(
              () => null
            );

        if (info) {
          setTimeout(
            () =>
              info
                .delete()
                .catch(
                  () => {}
                ),
            3000
          );
        }

        return;
      }

      // ==========================
      // MUTE
      // ==========================

      if (
        command === "mute"
      ) {
        if (
          !isAdmin(
            message.member
          )
        ) {
          return reply(
            "❌ Sadece Yönetici kullanabilir."
          );
        }

        const member =
          message.mentions.members.first();

        if (!member) {
          return reply(
            "Kullanım: `.mute @oyuncu`"
          );
        }

        await member
          .timeout(
            10 * 60 * 1000,
            "Yönetici mute"
          )
          .catch(() => {});

        return reply(
          `🔇 ${member} 10 dakika susturuldu.`
        );
      }

      // ==========================
      // UNMUTE
      // ==========================

      if (
        command ===
        "unmute"
      ) {
        if (
          !isAdmin(
            message.member
          )
        ) {
          return reply(
            "❌ Sadece Yönetici kullanabilir."
          );
        }

        const member =
          message.mentions.members.first();

        if (!member) {
          return reply(
            "Kullanım: `.unmute @oyuncu`"
          );
        }

        await member
          .timeout(
            null,
            "Mute kaldırıldı"
          )
          .catch(() => {});

        return reply(
          `🔊 ${member} susturması kaldırıldı.`
        );
      }

      // ==========================
      // KICK
      // ==========================

      if (
        command === "kick"
      ) {
        if (
          !isAdmin(
            message.member
          )
        ) {
          return reply(
            "❌ Sadece Yönetici kullanabilir."
          );
        }

        const member =
          message.mentions.members.first();

        if (!member) {
          return reply(
            "Kullanım: `.kick @oyuncu`"
          );
        }

        await member
          .kick(
            "Futbol RP Yönetimi"
          )
          .catch(() => {});

        return reply(
          `👢 ${member} sunucudan atıldı.`
        );
      }

      // ==========================
      // KANAL KİLİTLE
      // ==========================

      if (
        command ===
        "kilitle"
      ) {
        if (
          !isAdmin(
            message.member
          )
        ) {
          return reply(
            "❌ Sadece Yönetici kullanabilir."
          );
        }

        await message.channel
          .permissionOverwrites
          .edit(
            message.guild.roles
              .everyone,
            {
              SendMessages:
                false
            }
          )
          .catch(() => {});

        return reply(
          "🔒 Kanal kilitlendi."
        );
      }

      // ==========================
      // KANAL AÇ
      // ==========================

      if (
        command ===
        "kilitac"
      ) {
        if (
          !isAdmin(
            message.member
          )
        ) {
          return reply(
            "❌ Sadece Yönetici kullanabilir."
          );
        }

        await message.channel
          .permissionOverwrites
          .edit(
            message.guild.roles
              .everyone,
            {
              SendMessages:
                null
            }
          )
          .catch(() => {});

        return reply(
          "🔓 Kanal açıldı."
        );
      }

    } catch (error) {
      console.error(
        `❌ .${command} komut hatası:`,
        error
      );

      return reply(
        "❌ Komut çalışırken bir hata oluştu. Botun Discord yetkilerini ve Intent ayarlarını kontrol et."
      );
    }
  }
);

// ==============================
// HATA YAKALAMA
// ==============================

process.on(
  "unhandledRejection",
  error => {
    console.error(
      "❌ Unhandled Rejection:",
      error
    );
  }
);

process.on(
  "uncaughtException",
  error => {
    console.error(
      "❌ Uncaught Exception:",
      error
    );
  }
);

// ==============================
// BOTU BAŞLAT
// EN SONDA
// ==============================

client.login(TOKEN);
