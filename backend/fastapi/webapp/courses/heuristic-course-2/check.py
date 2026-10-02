#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kiem tra trang khoa hoc nay. Logic dung chung nam o engine/kiem_khoa_hoc.py.

    python check.py --tinh     # tinh: index.html, ban sao engine, khoaHoc, bundle
    python check.py            # + FastAPI that tren SQLite tam, nap bundle, mo bang Chromium
    python check.py --anh      # nhu tren, chup anh vao _shots/

Noi dung khong con nam trong trang: no o database, va bundle nguon o
backend/course-content/<khoaHoc>.json.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "engine"))

import kiem_khoa_hoc

sys.exit(kiem_khoa_hoc.chay(HERE))
