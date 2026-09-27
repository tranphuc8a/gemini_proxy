# Wukong Xiangqi source data

These directories contain the Wukong Xiangqi game database and reference
documents. The browser apps under
`backend/fastapi/webapp/wukong-xiangqi-main/src` and `apps` do not load them at
runtime. Generators, parsers, and their input data remain beside the webapp so
their existing relative paths keep working.

This material stays in the repository but outside Vercel's `backend/fastapi`
Root Directory, so it is not included in the FastAPI function bundle.