#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kiem tra moi lab cua trang nay. Logic dung chung nam o engine/kiem_demo.py.

    python check.py --tinh              # chi kiem tra tinh, khong can trinh duyet
    python -m http.server 8792 --bind 127.0.0.1   # o mot cua so khac
    python check.py                     # them tang mo that bang Chromium
    python check.py --nhom "Gia thuyet Collatz"
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "engine"))

import kiem_demo

kiem_demo.chay(HERE, 8792)
