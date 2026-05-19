# UIT Campus Explorer

Demo web 3D de xem hai mo hinh `Day.glb` va `Night.glb` nhu mot landing page tuong tac.

## Chay local

```sh
npm run serve
```

Mo trinh duyet tai:

```txt
http://localhost:4173
```

## Chuc nang

- Load `model/Day.glb` cho ban ngay va `model/Night.glb` cho ban dem.
- Xoay camera orbit, zoom, pan va che do walk-through.
- Chuyen nhanh giua ngay va dem.
- Ban dem co emissive + UnrealBloomPass de den trong model sang ro hon.
- Ban ngay co sun light, shadow va cac tia nang de showcase anh sang.
- Dieu chinh exposure, toc do camera va bat/tat auto rotate.
- Shadow, fog, sky gradient, reflective ground va collider vat ly co ban cho mat san.

## Cai dependencies

```sh
npm install
```

Dependencies chi gom `three` va `cannon-es`; `node_modules/` duoc ignore khoi git.
