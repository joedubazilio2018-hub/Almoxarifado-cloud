from PIL import Image, ImageDraw
import os

os.makedirs("public", exist_ok=True)

def make(size, path, maskable=False):
    img = Image.new("RGBA", (size, size), (15, 23, 42, 255))
    d = ImageDraw.Draw(img)
    s = size * (0.58 if maskable else 0.70)
    x0 = (size - s) / 2
    y0 = (size - s) / 2 + size * 0.02
    blue = (56, 189, 248, 255)
    dark = (15, 23, 42, 255)
    mid = (14, 165, 233, 255)
    d.rounded_rectangle([x0, y0 + s*0.28, x0 + s, y0 + s], radius=s*0.06, fill=blue)
    d.rounded_rectangle([x0 - s*0.03, y0 + s*0.10, x0 + s + s*0.03, y0 + s*0.32], radius=s*0.05, fill=mid)
    hw = s * 0.22
    d.rounded_rectangle([size/2 - hw, y0 + s*0.48, size/2 + hw, y0 + s*0.58], radius=s*0.04, fill=dark)
    img.convert("RGB").save(path)

make(192, "public/icon-192.png")
make(512, "public/icon-512.png")
make(512, "public/icon-maskable-512.png", True)
make(180, "public/apple-touch-icon.png")
