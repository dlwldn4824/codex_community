# API Authorization Guide

Apply server-side authorization at each API endpoint instead of relying on hidden navigation or client-side route guards.

Administrative APIs should return `403 Forbidden` when an authenticated non-administrator attempts access. Keep normal administrator behavior unchanged while rejecting unauthorized roles before reading or serializing protected data.
