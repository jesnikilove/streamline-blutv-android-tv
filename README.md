# Streamline BluTV Android TV Prototype

This is a separate prototype for a TiviMate-style Streamline BluTV Android TV experience.

It is not the Roku app.

## Run

```bash
npm start
```

Open:

```text
http://127.0.0.1:4188
```

## What Works

- Xtream Codes login test through local proxy
- M3U playlist login test through local proxy
- Demo library fallback
- Live TV categories and channels
- Guide layout
- Movies/VOD layout
- Series layout
- Search, favorites, and settings

## Notes

The local Node server is needed because browsers often block direct provider requests with CORS.
