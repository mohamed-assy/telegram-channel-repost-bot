"""
بوت تيلجرام لنسخ ونشر المنشورات من قنوات تيلجرام
Telegram Bot for copying and reposting messages from channels
"""

import logging
from telethon import TelegramClient, events
from telethon.tl.types import PeerChannel, PeerChat
import asyncio
import json
import os
from datetime import datetime
from dotenv import load_dotenv

# تحميل متغيرات البيئة
load_dotenv()

# إعدادات السجلات
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# متغيرات من البيئة
API_ID = int(os.getenv('API_ID', '0'))
API_HASH = os.getenv('API_HASH', '')
BOT_TOKEN = os.getenv('BOT_TOKEN', '7670134638:AAGaTyzo90aabopOXEJ1YnmPu5ONMH7A6HE')
PHONE_NUMBER = os.getenv('PHONE_NUMBER', '')

# ملف تخزين البيانات
DATA_FILE = 'bot_data.json'

class RepostBot:
    def __init__(self):
        self.client = TelegramClient('bot_session', API_ID, API_HASH)
        self.bot_token = BOT_TOKEN
        self.destination_channel_id = None
        self.source_channels = {}
        self.last_message_ids = {}
        self.load_data()
    
    def load_data(self):
        """تحميل البيانات المحفوظة"""
        if os.path.exists(DATA_FILE):
            try:
                with open(DATA_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.destination_channel_id = data.get('destination_channel_id')
                    self.source_channels = data.get('source_channels', {})
                    self.last_message_ids = data.get('last_message_ids', {})
                    logger.info('✅ تم تحميل البيانات المحفوظة')
            except Exception as e:
                logger.error(f'❌ خطأ في تحميل البيانات: {e}')
                self.create_new_data_file()
        else:
            self.create_new_data_file()
    
    def create_new_data_file(self):
        """إنشاء ملف بيانات جديد"""
        data = {
            'destination_channel_id': None,
            'source_channels': {},
            'last_message_ids': {}
        }
        self.save_data()
        logger.info('📝 تم إنشاء ملف بيانات جديد')
    
    def save_data(self):
        """حفظ البيانات"""
        try:
            data = {
                'destination_channel_id': self.destination_channel_id,
                'source_channels': self.source_channels,
                'last_message_ids': self.last_message_ids
            }
            with open(DATA_FILE, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            logger.info('💾 تم حفظ البيانات')
        except Exception as e:
            logger.error(f'❌ خطأ في حفظ البيانات: {e}')
    
    async def start(self):
        """بدء البوت"""
        logger.info('🚀 جاري بدء البوت...')
        
        try:
            await self.client.start(bot_token=self.bot_token)
            logger.info('✅ تم تشغيل البوت بنجاح')
            
            # تسجيل معالجات الأوامر
            self.register_handlers()
            
            # بدء loop التحديث
            await self.start_update_loop()
            
        except Exception as e:
            logger.error(f'❌ خطأ في بدء البوت: {e}')
    
    def register_handlers(self):
        """تسجيل معالجات الأوامر"""
        
        @self.client.on(events.NewMessage(pattern='/start'))
        async def start_handler(event):
            await event.respond(
                '🤖 مرحباً بك في بوت نسخ المنشورات!\n\n'
                '📋 الأوامر:\n'
                '/add_source - إضافة قناة مصدر\n'
                '/list_sources - قائمة القنوات\n'
                '/remove_source - حذف قناة\n'
                '/set_destination - تعيين القناة المخصصة\n'
                '/status - الحالة الحالية\n\n'
                '💡 أضف البوت كعضو في القنوات ليعمل بشكل صحيح'
            )
        
        @self.client.on(events.NewMessage(pattern='/add_source'))
        async def add_source_handler(event):
            await event.respond(
                '📌 أرسل معرف القناة أو اسمها\n'
                'مثال: @channel_name أو -100123456789'
            )
            
            # الاستماع للرسالة التالية
            try:
                response = await self.client.wait_for_signal(event)
                # معالجة إضافة القناة
                await self.add_source(event, response)
            except:
                pass
        
        @self.client.on(events.NewMessage(pattern='/list_sources'))
        async def list_sources_handler(event):
            if not self.source_channels:
                await event.respond('📭 لا توجد قنوات مضافة')
                return
            
            channels_list = '\n'.join([
                f'{i+1}. {name} (ID: {channel_id})'
                for i, (channel_id, name) in enumerate(self.source_channels.items())
            ])
            
            await event.respond(f'📋 القنوات المضافة:\n\n{channels_list}')
        
        @self.client.on(events.NewMessage(pattern='/remove_source'))
        async def remove_source_handler(event):
            if not self.source_channels:
                await event.respond('📭 لا توجد قنوات للحذف')
                return
            
            channels_list = '\n'.join([
                f'{i+1}. {name}'
                for i, name in enumerate(self.source_channels.values())
            ])
            
            await event.respond(
                f'اختر القناة المراد حذفها:\n\n{channels_list}\n\n'
                'أرسل رقم القناة (مثال: 1)'
            )
        
        @self.client.on(events.NewMessage(pattern='/set_destination'))
        async def set_destination_handler(event):
            try:
                chat = await event.get_chat()
                self.destination_channel_id = chat.id
                self.save_data()
                await event.respond(
                    f'✅ تم تعيين القناة المخصصة:\n'
                    f'اسم: {chat.title}\n'
                    f'ID: {chat.id}\n\n'
                    f'سيتم نشر جميع المنشورات المنسوخة هنا'
                )
            except Exception as e:
                await event.respond(f'❌ خطأ: {e}')
        
        @self.client.on(events.NewMessage(pattern='/status'))
        async def status_handler(event):
            status_text = '📊 حالة البوت:\n\n'
            status_text += f'🎯 القناة المخصصة: {self.destination_channel_id if self.destination_channel_id else "لم يتم التعيين"}\n'
            status_text += f'📡 عدد القنوات المصدر: {len(self.source_channels)}\n'
            
            if self.source_channels:
                status_text += '\n📋 القنوات:\n'
                for channel_id, name in self.source_channels.items():
                    last_msg_id = self.last_message_ids.get(str(channel_id), 0)
                    status_text += f'  • {name} (آخر ID: {last_msg_id})\n'
            
            await event.respond(status_text)
    
    async def add_source(self, event, channel_input):
        """إضافة قناة مصدر"""
        try:
            # محاولة الحصول على معرف القناة
            try:
                channel = await self.client.get_entity(channel_input.text)
                channel_id = channel.id
                channel_name = channel.title if hasattr(channel, 'title') else str(channel)
                
                self.source_channels[str(channel_id)] = channel_name
                self.last_message_ids[str(channel_id)] = 0
                self.save_data()
                
                await event.respond(
                    f'✅ تم إضافة القناة:\n'
                    f'الاسم: {channel_name}\n'
                    f'ID: {channel_id}'
                )
            except:
                await event.respond('❌ لم أتمكن من إيجاد القناة')
        except Exception as e:
            await event.respond(f'❌ خطأ: {e}')
    
    async def start_update_loop(self):
        """بدء loop التحديث الدوري"""
        logger.info('🔄 بدء loop التحديث...')
        
        while True:
            try:
                await self.check_and_copy_messages()
                await asyncio.sleep(30)  # فحص كل 30 ثانية
            except Exception as e:
                logger.error(f'❌ خطأ في loop التحديث: {e}')
                await asyncio.sleep(30)
    
    async def check_and_copy_messages(self):
        """فحص ونسخ الرسائل الجديدة"""
        if not self.destination_channel_id:
            return
        
        for channel_id_str, channel_name in self.source_channels.items():
            try:
                channel_id = int(channel_id_str)
                last_msg_id = self.last_message_ids.get(channel_id_str, 0)
                
                # الحصول على آخر الرسائل من القناة
                try:
                    channel = await self.client.get_entity(channel_id)
                    
                    async for message in self.client.iter_messages(
                        channel,
                        offset_id=last_msg_id,
                        limit=10,
                        reverse=True
                    ):
                        if message.id > last_msg_id:
                            # نسخ الرسالة إلى القناة المخصصة
                            try:
                                await self.client.send_message(
                                    self.destination_channel_id,
                                    message
                                )
                                
                                # تحديث آخر معرف رسالة
                                self.last_message_ids[channel_id_str] = message.id
                                self.save_data()
                                
                                logger.info(
                                    f'📢 تم نسخ رسالة من {channel_name} '
                                    f'(ID: {message.id})'
                                )
                            except Exception as e:
                                logger.error(
                                    f'❌ خطأ في نسخ الرسالة من {channel_name}: {e}'
                                )
                
                except Exception as e:
                    logger.error(f'❌ خطأ في الوصول إلى القناة {channel_name}: {e}')
            
            except Exception as e:
                logger.error(f'❌ خطأ في معالجة القناة: {e}')
    
    async def stop(self):
        """إيقاف البوت"""
        logger.info('⏹️ جاري إيقاف البوت...')
        await self.client.disconnect()
        logger.info('✅ تم إيقاف البوت')


async def main():
    """الدالة الرئيسية"""
    bot = RepostBot()
    
    try:
        # بدء البوت
        await bot.start()
        
        # الاستماع للإشارات للإيقاف الآمن
        await asyncio.Event().wait()
    
    except KeyboardInterrupt:
        logger.info('⏹️ تم إيقاف البوت من المستخدم')
    except Exception as e:
        logger.error(f'❌ خطأ: {e}')
    finally:
        await bot.stop()


if __name__ == '__main__':
    asyncio.run(main())
