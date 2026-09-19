#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kiem tra noi dung khoa nay. Logic dung chung nam o engine/kiem.py.

Chay:  python check.py
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(HERE)), "engine"))

import kiem

kiem.chay(HERE)
