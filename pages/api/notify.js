import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  // 只允許 POST 請求
  if (req.method !== 'POST') return res.status(405).end();

  const { name, email, samples, note } = req.body;

  try {
    // === 1. 發送 LINE 廣播通知給所有加入該機器人的 Operator ===
    const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (lineToken) {
      // 整理樣品清單文字
      const sampleText = samples.map((s, i) => `[${i+1}] 編碼: ${s.code} / 項目: ${s.service_item}`).join('\n');
      const message = `🔔 新的 NMR 送測委託！\n\n👤 委託人: ${name}\n📧 Email: ${email}\n🧪 樣品數量: ${samples.length} 件\n\n📌 樣品明細:\n${sampleText}\n\n📝 備註:\n${note || '無'}\n\n👉 請登入系統後台處理與計費！`;

      await fetch('https://api.line.me/v2/bot/message/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${lineToken}`
        },
        // broadcast 代表「發送給所有加此機器人為好友的人」
        body: JSON.stringify({
          messages: [{ type: 'text', text: message }]
        })
      });
    }

    // === 2. 發送 Email 給委託人 ===
    const emailUser = process.env.GMAIL_USER;
    const emailPass = process.env.GMAIL_APP_PASSWORD;

    if (emailUser && emailPass) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: emailUser, pass: emailPass }
      });

      const mailOptions = {
        from: `"NDHU NMR 預約系統" <${emailUser}>`,
        to: email,
        subject: '✅ [NDHU NMR] 您的送測委託已成功接收',
        text: `親愛的 ${name} 您好：\n\n我們已收到您的 NMR 送測委託單。\n您共提交了 ${samples.length} 件樣品，我們會盡快為您安排處理。\n如有任何特殊需求或問題，管理員會透過此 Email 與您聯繫。\n\n感謝您的使用！\n\nNDHU NMR 實驗室團隊 敬上`
      };

      await transporter.sendMail(mailOptions);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('通知發送失敗:', error);
    res.status(500).json({ error: 'Notification failed' });
  }
}