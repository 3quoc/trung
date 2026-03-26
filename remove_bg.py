import sys
import os

try:
    from PIL import Image
    print("Pillow installed.")
except ImportError:
    print("Installing Pillow...")
    os.system(f"{sys.executable} -m pip install -q Pillow")
    from PIL import Image

def remove_white(image_path):
    if not os.path.exists(image_path):
        print(f"File not found: {image_path}")
        return
        
    img = Image.open(image_path)
    img = img.convert("RGBA")
    datas = img.getdata()

    new_data = []
    for item in datas:
        # Nếu pixel là màu trắng hoặc gần trắng (R, G, B > 235)
        if item[0] > 235 and item[1] > 235 and item[2] > 235:
            new_data.append((255, 255, 255, 0)) # Thành trong suốt
        else:
            new_data.append(item)

    img.putdata(new_data)
    img.save(image_path, "PNG")
    print(f"Processed: {image_path}")

remove_white("d:/game/anime_lion.png")
remove_white("d:/game/anime_deer.png")
print("Done!")
