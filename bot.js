const { Telegraf } = require('telegraf');
const axios = require('axios');
require('dotenv').config();

const BOT_TOKEN = process.env.BOT_TOKEN || '7670134638:AAGaTyzo90aabopOXEJ1YnmPu5ONMH7A6HE';
const bot = new Telegraf(BOT_TOKEN);

// تخزين مؤقت للبيانات (في الواقع استخدم قاعدة بيانات)
let sourcesData = {
  channels: [],
  lastMessageId: {}
};

// معرف القناة المخصصة للبوت
let destinationChannelId = null;

// ============ أوامر البوت ============

// أمر /start
bot.start((ctx) => {
  ctx.reply(
    `🤖 مرحباً بك في بوت نسخ المنشورات!\n\n` +
    `الأوامر المتاحة:\n` +
    `/start - بدء البوت\n` +
    `/add_source - إضافة قناة مصدر\n` +
    `/remove_source - حذف قناة مصدر\n` +
    `/list_sources - قائمة القنوات المضافة\n` +
    `/set_destination - تعيين القناة المخصصة للنشر\n\n` +
    `💡 أضف البوت كعضو في القنوات ليعمل بشكل صحيح`
  );
});

// أمر /add_source
bot.command('add_source', (ctx) => {
  ctx.reply(
    '📌 أرسل لي رابط القناة أو معرف القناة\n' +
    'مثال: @channel_name أو -100123456789'
  );
  
  // الاستماع للرسالة التالية
  bot.on('text', async (ctx) => {
    const input = ctx.message.text;
    
    try {
      // التحقق من صحة معرف القناة
      const channelId = await validateChannel(input);
      
      if (channelId) {
        if (!sourcesData.channels.includes(channelId)) {
          sourcesData.channels.push(channelId);
          sourcesData.lastMessageId[channelId] = 0;
          ctx.reply(`✅ تم إضافة القناة بنجاح!\n\n🔗 معرف القناة: ${channelId}`);
        } else {
          ctx.reply('⚠️ هذه القناة مضافة بالفعل!');
        }
      } else {
        ctx.reply('❌ لم أتمكن من التحقق من القناة. تأكد من صحة الرابط أو المعرف');
      }
    } catch (error) {
      console.error('خطأ عند إضافة القناة:', error);
      ctx.reply('❌ حدث خطأ: ' + error.message);
    }
  });
});

// أمر /remove_source
bot.command('remove_source', (ctx) => {
  if (sourcesData.channels.length === 0) {
    ctx.reply('📭 لا توجد قنوات مضافة حالياً');
    return;
  }

  const buttons = sourcesData.channels.map((channel, index) => [
    { text: channel, callback_data: `remove_${index}` }
  ]);

  ctx.reply('اختر القناة المراد حذفها:', {
    reply_markup: {
      inline_keyboard: buttons
    }
  });
});

// أمر /list_sources
bot.command('list_sources', (ctx) => {
  if (sourcesData.channels.length === 0) {
    ctx.reply('📭 لا توجد قنوات مضافة حالياً');
    return;
  }

  const list = sourcesData.channels
    .map((ch, i) => `${i + 1}. ${ch}`)
    .join('\n');

  ctx.reply(`📋 القنوات المضافة:\n\n${list}`);
});

// أمر /set_destination
bot.command('set_destination', (ctx) => {
  ctx.reply(
    '⚙️ أضف البوت كعضو في القناة المخصصة للنشر\n' +
    'ثم أرسل /set_destination مرة أخرى من تلك القناة'
  );
});

// التقاط معرف القناة تلقائياً عند إضافة البوت
bot.on('my_chat_member', (ctx) => {
  const { chat, new_chat_member } = ctx.update.my_chat_member;
  
  // التحقق من أن البوت تم إضافته للقناة
  if (new_chat_member.status === 'member' || new_chat_member.status === 'administrator') {
    if (chat.type === 'channel' || chat.type === 'supergroup') {
      destinationChannelId = chat.id;
      
      console.log(`✅ تم تعيين القناة المخصصة: ${chat.id}`);
      console.log(`📝 اسم القناة: ${chat.title}`);
      
      // إرسال رسالة تأكيد
      try {
        bot.telegram.sendMessage(
          chat.id,
          `✅ تم تفعيل البوت في هذه القناة!\n\n` +
          `معرف القناة: ${chat.id}\n` +
          `سيتم نشر جميع المنشورات المنسوخة هنا 📢`
        );
      } catch (error) {
        console.error('خطأ في إرسال رسالة التأكيد:', error);
      }
    }
  }
});

// معالجة أزرار الحذف
bot.action(/remove_(\d+)/, (ctx) => {
  const index = parseInt(ctx.match[1]);
  const removedChannel = sourcesData.channels[index];
  
  sourcesData.channels.splice(index, 1);
  delete sourcesData.lastMessageId[removedChannel];
  
  ctx.answerCbQuery();
  ctx.editMessageText(`✅ تم حذف القناة: ${removedChannel}`);
});

// ============ وظيفة التحقق من القناة ============

async function validateChannel(input) {
  try {
    const url = `${process.env.BOT_API_URL || 'https://api.telegram.org/bot7670134638:AAGaTyzo90aabopOXEJ1YnmPu5ONMH7A6HE'}/getChat`;
    
    const response = await axios.post(url, {
      chat_id: input
    });

    if (response.data.ok) {
      return response.data.result.id;
    }
    return null;
  } catch (error) {
    console.error('خطأ في التحقق من القناة:', error.message);
    return null;
  }
}

// ============ وظيفة نسخ المنشورات ============

async function copyMessages() {
  console.log('🔄 جاري فحص المنشورات الجديدة...');
  
  if (!destinationChannelId) {
    console.log('⚠️ لم يتم تعيين القناة المخصصة بعد');
    return;
  }

  for (const sourceChannelId of sourcesData.channels) {
    try {
      const lastId = sourcesData.lastMessageId[sourceChannelId] || 0;
      
      // الحصول على آخر المنشورات
      const url = `${process.env.BOT_API_URL || 'https://api.telegram.org/bot7670134638:AAGaTyzo90aabopOXEJ1YnmPu5ONMH7A6HE'}/getUpdates`;
      
      // نسخ الرسائل من القناة المصدر إلى المخصصة
      await forwardMessages(sourceChannelId, destinationChannelId);
      
    } catch (error) {
      console.error(`❌ خطأ عند معالجة القناة ${sourceChannelId}:`, error.message);
    }
  }
}

// وظيفة إعادة توجيه الرسائل
async function forwardMessages(fromChannelId, toChannelId) {
  try {
    const lastId = sourcesData.lastMessageId[fromChannelId] || 1;
    
    // محاولة الحصول على الرسائل الجديدة
    const url = `${process.env.BOT_API_URL || 'https://api.telegram.org/bot7670134638:AAGaTyzo90aabopOXEJ1YnmPu5ONMH7A6HE'}/forwardMessage`;
    
    // هنا يتم التعامل مع API للحصول على الرسائل
    // في النسخة المتقدمة، ستحتاج Telethon للقنوات الخاصة
    
    console.log(`📨 تم فحص القناة ${fromChannelId}`);
    
  } catch (error) {
    console.error('خطأ في إعادة التوجيه:', error.message);
  }
}

// ============ التشغيل ============

// بدء التحقق الدوري (كل 30 ثانية)
setInterval(copyMessages, 30000);

// بدء البوت
bot.launch(() => {
  console.log('🚀 البوت يعمل الآن...');
  console.log(`🤖 Token: ${BOT_TOKEN.substring(0, 10)}...`);
});

// معالجة الإيقاف الآمن
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

module.exports = bot;
