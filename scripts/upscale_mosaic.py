"""Upscale Mosaic image using Real-ESRGAN 4x.

Patches torchvision import compatibility issue before loading realesrgan.
"""
import os
import sys

# Patch torchvision compatibility BEFORE importing realesrgan
import torchvision.transforms.functional as F
import types

# Create a fake module to satisfy the old import
fake_module = types.ModuleType("torchvision.transforms.functional_tensor")
fake_module.rgb_to_grayscale = F.rgb_to_grayscale
sys.modules["torchvision.transforms.functional_tensor"] = fake_module

import torch
import numpy as np
from PIL import Image
from realesrgan import RealESRGANer
from basicsr.archs.rrdbnet_arch import RRDBNet

INPUT_PATH = "/Users/stevenjunop/Downloads/mosaic_seedream_45_hyperreal.png"
OUTPUT_PATH = "/Users/stevenjunop/Downloads/mosaic_hyperreal_4x.png"


def main():
    print(f"Loading image: {INPUT_PATH}")
    img = Image.open(INPUT_PATH).convert("RGB")
    print(f"Input size: {img.size}")

    # RealESRGAN x4plus model
    model = RRDBNet(
        num_in_ch=3, num_out_ch=3, num_feat=64,
        num_block=23, num_grow_ch=32, scale=4,
    )

    # Use CPU — MPS has intermittent issues with Real-ESRGAN conv ops
    device = "cpu"
    print(f"Device: {device}")

    upsampler = RealESRGANer(
        scale=4,
        model_path="https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth",
        model=model,
        tile=512,
        tile_pad=10,
        pre_pad=0,
        half=False,
        device=device,
    )

    # Convert PIL → BGR numpy (cv2 format)
    import cv2
    img_np = np.array(img)
    img_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)

    print("Running Real-ESRGAN 4x upscale (this may take 1-2 minutes on CPU)...")
    output, _ = upsampler.enhance(img_bgr, outscale=4)

    output_rgb = cv2.cvtColor(output, cv2.COLOR_BGR2RGB)
    result = Image.fromarray(output_rgb)
    print(f"Output size: {result.size}")

    result.save(OUTPUT_PATH, "PNG", optimize=True)
    file_size = os.path.getsize(OUTPUT_PATH)
    print(f"Saved: {OUTPUT_PATH} ({file_size / 1e6:.1f} MB)")
    print("Done!")


if __name__ == "__main__":
    main()
