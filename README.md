# StockCare

StockCare runs **fully offline**. It does not need MySQL, phpMyAdmin, or an internet connection.

## Run it

```powershell
npm start
```

Then open **http://localhost:3000/register** in your browser.

If port 3000 is unavailable, StockCare automatically tries 3001, 3002, and so on. The terminal prints the exact URL it is using.

> Note: use `localhost`, not `127.0.0.1`. Another dev server on this machine may be holding the IPv4 side of port 3000; `localhost` resolves to IPv6 and reaches StockCare.

## Units and pack sizes

`Quantity` counts the units/packages (for example, 22 bottles). `Unit` is the package label (`bottle`, `can`, `box`, …). If each package has a fixed size, fill in **Amount per unit** and **Amount unit** — e.g. `80` + `mL` for an 80 mL bottle, or `1` + `L` for a 1 L bottle. The stock table then shows `22 bottle (80 mL each)`.

`Unit cost` is the price of one package, and `Total value` = `Quantity × Unit cost`.

## Where data is stored

All users, inventory, and logs are kept in:

```
data/stockcare-db.json
```

The file is created automatically on first run. It is a plain JSON file, so you can back it up by copying it.

## Reset all data

```powershell
npm run migrate -- --reset
```

This clears every table. Run `npm run migrate` without `--reset` to verify the database while keeping existing data.

## Other commands

```powershell
npm run xian      # restart automatically when files change (needs nodemon)
npm run xianca    # open the desktop/Electron window
npm run xian-build
```
