"""
Diagnostic SMTP Gmail — affiche le code + message brut renvoye par Google,
au lieu du message generique attrape par notify_all(). Lance-le pour voir
EXACTEMENT pourquoi Google refuse (534/535/530...).

Usage : python -m scripts.debug_smtp
"""
import smtplib
from core.config import settings

print(f"Host        : {settings.smtp_host}:{settings.smtp_port}")
print(f"User        : {settings.smtp_user!r}")
print(f"From        : {settings.smtp_from!r}")
print(f"Password len: {len(settings.smtp_password)} caracteres")
print(f"Password rep: {settings.smtp_password!r}")  # affiche les espaces/guillemets eventuels
print("-" * 60)

try:
    srv = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15)
    srv.set_debuglevel(1)  # affiche le dialogue SMTP complet ligne par ligne
    srv.ehlo()
    srv.starttls()
    srv.ehlo()
    srv.login(settings.smtp_user, settings.smtp_password)
    print("\n✅ LOGIN REUSSI")
    srv.quit()
except smtplib.SMTPAuthenticationError as e:
    print(f"\n❌ SMTPAuthenticationError")
    print(f"   Code    : {e.smtp_code}")
    print(f"   Message : {e.smtp_error.decode() if isinstance(e.smtp_error, bytes) else e.smtp_error}")
except Exception as e:
    print(f"\n❌ Autre erreur : {type(e).__name__}: {e}")