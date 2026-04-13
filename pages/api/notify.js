import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { name, email, phone, unit, samples, note } = req.body;
  console.log("1. 收到表單資料，準備發送通知...");

  try {
    // === 修改這裡：在樣品明細中加入 Solvent 資訊 ===
const sampleText = samples.map((s, i) => `[${i+1}] 編碼: ${s.code} / Solvent: ${s.solvent || '未填'} / 測試: ${s.test_items || '未填'} / 項目: ${s.service_item}`).join('\n');    
    // === 1. 發送 LINE 廣播通知 ===
    const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (lineToken) {
      console.log("✅ 成功讀取 LINE Token，準備發送 LINE...");
      const message = `🔔 新的 NMR 送測委託！\n\n👤 委託人: ${name}\n🏢 單位: ${unit}\n📞 電話: ${phone}\n📧 Email: ${email}\n\n🧪 樣品數量: ${samples.length} 件\n📌 樣品明細:\n${sampleText}\n\n📝 備註:\n${note || '無'}\n\n👉 請登入系統後台處理與計費！`;

      await fetch('https://api.line.me/v2/bot/message/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${lineToken}`
        },
        body: JSON.stringify({
          messages: [{ type: 'text', text: message }]
        })
      });
    }

    // === 2. 發送 Email ===
    const emailUser = process.env.GMAIL_USER;
    const emailPass = process.env.GMAIL_APP_PASSWORD;

    if (emailUser && emailPass) {
      console.log("✅ 成功讀取 Gmail 帳密，準備發信...");
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: emailUser, pass: emailPass }
      });

      const emailBodyText = `親愛的 ${name} 您好：\n\n我們已收到您的 NMR 送測委託單，詳細內容如下：\n\n👤 委託人: ${name}\n🏢 單位: ${unit}\n📞 電話: ${phone}\n📧 Email: ${email}\n\n🧪 樣品數量: ${samples.length} 件\n📌 樣品明細:\n${sampleText}\n\n📝 備註:\n${note || '無'}\n\n我們會盡快為您安排處理。如有任何特殊需求或問題，管理員會透過此 Email 與您聯繫。\n\n感謝您的使用！\n\nNDHU NMR Operator`;

      await transporter.sendMail({
        from: `"NDHU NMR 預約系統" <${emailUser}>`,
        to: email,
        subject: '✅ [NDHU NMR] 您的送測委託已成功接收',
        text: emailBodyText
      });
      console.log("📧 Email 發送成功！");
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ 通知發送過程發生例外錯誤:', error);
    res.status(500).json({ error: 'Notification failed' });
  }
}