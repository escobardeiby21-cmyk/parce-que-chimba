import os
import qrcode
from PIL import Image, ImageDraw, ImageFont

# Crear canvas de alta resolución para impresión (1200 x 1200 px)
size = 1200
img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# Dibujar fondo circular oscuro con borde dorado neon
center = size // 2
radius = (size // 2) - 20

# Círculo dorado exterior
draw.ellipse([center - radius, center - radius, center + radius, center + radius], fill=(20, 20, 20, 255), outline=(245, 158, 11, 255), width=24)
# Círculo interno rojo borgoña / amber
radius_in = radius - 15
draw.ellipse([center - radius_in, center - radius_in, center + radius_in, center + radius_in], fill=(15, 15, 15, 255), outline=(239, 68, 68, 255), width=8)

# 1. Cargar el Logo Oficial de Que Chimba Parce
logo_path = r'c:\Users\deiby\OneDrive\Escritorio\PARCE QUE CHIMBA\parce-que-chimba\public\logo.png'
if os.path.exists(logo_path):
    logo = Image.open(logo_path).convert("RGBA")
    # Escalar logo para la parte superior del sticker
    logo_size = 480
    logo.thumbnail((logo_size, logo_size), Image.Resampling.LANCZOS)
    logo_x = center - (logo.width // 2)
    logo_y = 110
    img.paste(logo, (logo_x, logo_y), logo)

# 2. Generar el Código QR oficial para la web parcequechimba.com
qr = qrcode.QRCode(
    version=1,
    error_correction=qrcode.constants.ERROR_CORRECT_H,
    box_size=10,
    border=2,
)
qr.add_data('https://parcequechimba.com')
qr.make(fit=True)

qr_img = qr.make_image(fill_color="#f59e0b", back_color="#000000").convert("RGBA")
qr_size = 320
qr_img = qr_img.resize((qr_size, qr_size), Image.Resampling.LANCZOS)

# Dibujar un marco dorado alrededor del QR
qr_x = center - (qr_size // 2)
qr_y = 600
draw.rectangle([qr_x - 12, qr_y - 12, qr_x + qr_size + 12, qr_y + qr_size + 12], fill=(0, 0, 0, 255), outline=(245, 158, 11, 255), width=6)
img.paste(qr_img, (qr_x, qr_y), qr_img)

# 3. Textos explicativos en tipografía clara
try:
    font_title = ImageFont.truetype("arialbd.ttf", 46)
    font_sub = ImageFont.truetype("arial.ttf", 36)
    font_small = ImageFont.truetype("arialbd.ttf", 34)
except:
    font_title = ImageFont.load_default()
    font_sub = ImageFont.load_default()
    font_small = ImageFont.load_default()

# Texto "¡ESCÁNEA Y PIDE!"
text_escanea = "¡ESCÁNEA Y PIDE AHORA!"
w, h = draw.textlength(text_escanea, font=font_title), 46
draw.text((center - (w // 2), 535), text_escanea, fill=(255, 255, 255), font=font_title)

# Texto Dominio: parcequechimba.com
text_url = "🌐 parcequechimba.com"
w, h = draw.textlength(text_url, font=font_sub), 36
draw.text((center - (w // 2), 960), text_url, fill=(245, 158, 11), font=font_sub)

# Texto Domicilio: 🛵 Domicilio a solo 2.00€
text_domi = "🛵 Domicilio solo 2.00€"
w, h = draw.textlength(text_domi, font=font_small), 34
draw.text((center - (w // 2), 1015), text_domi, fill=(239, 68, 68), font=font_small)

# Guardar en archivos del proyecto e imagen de artefacto
out_project = r'c:\Users\deiby\OneDrive\Escritorio\PARCE QUE CHIMBA\parce-que-chimba\public\pegatina_oficial_que_chimba_parce.png'
out_artifact = r'C:\Users\deiby\.gemini\antigravity\brain\0c60f0bb-3311-411b-be4f-7b09b90f74b2\pegatina_oficial_que_chimba_parce.png'

img.save(out_project, "PNG")
img.save(out_artifact, "PNG")
console_msg = f"Pegatina creada con éxito en {out_project}"
print(console_msg)
