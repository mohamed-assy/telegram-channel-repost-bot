const { Telegraf } = require('telegraf');
const axios = require('axios');

const BOT_TOKEN = process.env.BOT_TOKEN || '7670134638:AAGaTyzo90aabopOXEJ1YnmPu5ONMH7A6HE';
const bot = new Telegraf(BOT_TOKEN);

// تخزين مؤقت
let sourcesData = {
  channels: [],
  lastMessageId: {}
};

let destinationChannelId = null;

// ============ معالجات البوت ============

bot.start((ctx) => {
  ctx.reply(
    `🤖 مرحباً بك في بوت نسخ المنشورات!\n\n` +
    `الأوامر:\n` +
    `/add_source - إضافة قناة\n` +
    `/list_sources - قائمة القنوات\n` +
    `/remove_source - حذف قناة\n\n` +
    `💡 أضف البوت لقناتك المخصصة وسيتم التعرف عليها تلقائياً`
  );
});

bot.command('add_source', (ctx) => {
  ctx.session = ctx.session || {};
  ctx.session.waitingForChannel = true;
  ctx.reply('📌 أرسل معرف القناة أو @اسم_القناة');
});

bot.command('list_sources', (ctx) => {
  if (sourcesData.channels.length === 0) {
    ctx.reply('📭 لا توجد قنوات مضافة');
    return;
  }
  const list = sourcesData.channels.map((ch, i) => `${i + 1}. ${ch}`).join('\n');
  ctx.reply(`📋 القنوات:\n\n${list}`);
});

bot.on('text', async (ctx) => {
  if (ctx.session?.waitingForChannel) {
    ctx.session.waitingForChannel = false;
    const input = ctx.message.text;
    
    try {
      const channelId = await validateChannel(input);
      if (channelId) {
        if (!sourcesData.channels.includes(channelId)) {
          sourcesData.channels.push(channelId);
          sourcesData.lastMessageId[channelId] = 0;
          ctx.reply(`✅ تم إضافة القناة: ${input}`);
        } else {
          ctx.reply('⚠️ القناة مضافة بالفعل');
        }
      } else {
        ctx.reply('❌ معرف غير صحيح');
      }
    } catch (error) {
      ctx.reply('❌ خطأ: ' + error.message);
    }
  }
});

bot.on('my_chat_member', (ctx) => {
  const { chat, new_chat_member } = ctx.update.my_chat_member;
  
  if ((new_chat_member.status === 'member' || new_chat_member.status === 'administrator') &&
      (chat.type === 'channel' || chat.type === 'supergroup')) {
    destinationChannelId = chat.id;
    
    try {
      bot.telegram.sendMessage(
        chat.id,
        `✅ تم تفعيل البوت!\n\n` +
        `معرف القناة: ${chat.id}\n` +
        `سيتم نشر المنشورات المنسوخة هنا 📢`
      );
    } catch (error) {
      console.error('خطأ:', error.message);
    }
  }
});

// ============ دالة Webhook ============

module.exports = async (req, res) => {
  if (req.method === 'POST') {
    try {
      await bot.handleUpdate(req.body, res);
      res.status(200).json({ ok: true });
    } catch (error) {
      console.error('خطأ في معالجة التحديث:', error);
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(200).json({ status: 'Bot is running' });
  }
};

// ============ دوال مساعدة ============

async function validateChannel(input) {
  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/getChat`,
      { chat_id: input }
    );
    return response.data.ok ? response.data.result.id : null;
  } catch {
    return null;
  }
}
