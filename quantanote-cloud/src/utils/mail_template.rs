/// 渲染验证码邮件
pub fn render_verify_code_mail(code: &str, lang: &str) -> (String, String) {
    match lang {
        "zh-CN" | "zh" => (
            "QuantaNote 邮箱验证码".to_string(),
            render_verify_code_zh_cn(code),
        ),
        _ => (
            "QuantaNote Verification Code".to_string(),
            render_verify_code_en(code),
        ),
    }
}

/// 中文验证码邮件模板
fn render_verify_code_zh_cn(code: &str) -> String {
    format!(
        r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>验证码</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }}
        .container {{
            background-color: #ffffff;
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }}
        .header {{
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #6366f1;
            padding-bottom: 20px;
        }}
        .header h1 {{
            color: #6366f1;
            margin: 0;
            font-size: 28px;
        }}
        .code-box {{
            background-color: #f0f0ff;
            border: 2px dashed #6366f1;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            margin: 30px 0;
        }}
        .code {{
            font-size: 36px;
            font-weight: bold;
            color: #6366f1;
            letter-spacing: 8px;
            font-family: 'Courier New', monospace;
        }}
        .info {{
            color: #666;
            font-size: 14px;
            line-height: 1.8;
        }}
        .warning {{
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            color: #856404;
            font-size: 14px;
        }}
        .footer {{
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #999;
            font-size: 12px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>QuantaNote</h1>
        </div>
        <p class="info">您好！</p>
        <p class="info">您正在注册 QuantaNote 账号，您的验证码是：</p>
        <div class="code-box">
            <div class="code">{code}</div>
        </div>
        <p class="info">验证码有效期为 5 分钟，请尽快完成验证。</p>
        <div class="warning">
            如果这不是您本人的操作，请忽略此邮件。
        </div>
        <div class="footer">
            <p>此邮件由系统自动发送，请勿回复。</p>
            <p>&copy; 2026 QuantaNote. All rights reserved.</p>
        </div>
    </div>
</body>
</html>"#
    )
}

/// 英文验证码邮件模板
fn render_verify_code_en(code: &str) -> String {
    format!(
        r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verification Code</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }}
        .container {{
            background-color: #ffffff;
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }}
        .header {{
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #6366f1;
            padding-bottom: 20px;
        }}
        .header h1 {{
            color: #6366f1;
            margin: 0;
            font-size: 28px;
        }}
        .code-box {{
            background-color: #f0f0ff;
            border: 2px dashed #6366f1;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            margin: 30px 0;
        }}
        .code {{
            font-size: 36px;
            font-weight: bold;
            color: #6366f1;
            letter-spacing: 8px;
            font-family: 'Courier New', monospace;
        }}
        .info {{
            color: #666;
            font-size: 14px;
            line-height: 1.8;
        }}
        .warning {{
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            color: #856404;
            font-size: 14px;
        }}
        .footer {{
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #999;
            font-size: 12px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>QuantaNote</h1>
        </div>
        <p class="info">Hello!</p>
        <p class="info">You are registering a QuantaNote account. Your verification code is:</p>
        <div class="code-box">
            <div class="code">{code}</div>
        </div>
        <p class="info">The verification code is valid for 5 minutes. Please complete the verification as soon as possible.</p>
        <div class="warning">
            If this is not your operation, please ignore this email.
        </div>
        <div class="footer">
            <p>This email is sent automatically, please do not reply.</p>
            <p>&copy; 2026 QuantaNote. All rights reserved.</p>
        </div>
    </div>
</body>
</html>"#
    )
}

/// 渲染重置密码邮件
pub fn render_reset_password_mail(token: &str, lang: &str) -> (String, String) {
    match lang {
        "zh-CN" | "zh" => (
            "QuantaNote 密码重置".to_string(),
            render_reset_password_zh_cn(token),
        ),
        _ => (
            "QuantaNote Password Reset".to_string(),
            render_reset_password_en(token),
        ),
    }
}

fn render_reset_password_zh_cn(token: &str) -> String {
    format!(
        r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>密码重置</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5; }}
        .container {{ background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }}
        .header {{ text-align: center; margin-bottom: 30px; border-bottom: 2px solid #6366f1; padding-bottom: 20px; }}
        .header h1 {{ color: #6366f1; margin: 0; font-size: 28px; }}
        .code-box {{ background-color: #f0f0ff; border: 2px dashed #6366f1; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0; }}
        .code {{ font-size: 18px; font-weight: bold; color: #6366f1; letter-spacing: 2px; font-family: 'Courier New', monospace; word-break: break-all; }}
        .info {{ color: #666; font-size: 14px; line-height: 1.8; }}
        .warning {{ background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; color: #856404; font-size: 14px; }}
        .footer {{ text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header"><h1>QuantaNote</h1></div>
        <p class="info">您好！</p>
        <p class="info">您正在重置 QuantaNote 账号的密码，您的重置码是：</p>
        <div class="code-box"><div class="code">{token}</div></div>
        <p class="info">请在应用中输入此重置码完成密码重置。重置码有效期为 15 分钟。</p>
        <div class="warning">如果这不是您本人的操作，请忽略此邮件。</div>
        <div class="footer">
            <p>此邮件由系统自动发送，请勿回复。</p>
            <p>&copy; 2026 QuantaNote. All rights reserved.</p>
        </div>
    </div>
</body>
</html>"#
    )
}

fn render_reset_password_en(token: &str) -> String {
    format!(
        r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5; }}
        .container {{ background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }}
        .header {{ text-align: center; margin-bottom: 30px; border-bottom: 2px solid #6366f1; padding-bottom: 20px; }}
        .header h1 {{ color: #6366f1; margin: 0; font-size: 28px; }}
        .code-box {{ background-color: #f0f0ff; border: 2px dashed #6366f1; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0; }}
        .code {{ font-size: 18px; font-weight: bold; color: #6366f1; letter-spacing: 2px; font-family: 'Courier New', monospace; word-break: break-all; }}
        .info {{ color: #666; font-size: 14px; line-height: 1.8; }}
        .warning {{ background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; color: #856404; font-size: 14px; }}
        .footer {{ text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header"><h1>QuantaNote</h1></div>
        <p class="info">Hello!</p>
        <p class="info">You are resetting the password for your QuantaNote account. Your reset code is:</p>
        <div class="code-box"><div class="code">{token}</div></div>
        <p class="info">Please enter this reset code in the app to complete the password reset. The code is valid for 15 minutes.</p>
        <div class="warning">If you did not request this, please ignore this email.</div>
        <div class="footer">
            <p>This email is sent automatically, please do not reply.</p>
            <p>&copy; 2026 QuantaNote. All rights reserved.</p>
        </div>
    </div>
</body>
</html>"#
    )
}
