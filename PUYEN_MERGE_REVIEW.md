# Review branch `puyen`

Nguon so sanh: `main...puyen`

## Tong quan

- Branch `puyen` co 1 commit rieng: `9e42aea9 add pond, koi fish with animation and maple tree`.
- `main` dang di truoc `puyen` 2 commit: `761252c1 checkpoint`, `8f3a62b8 checkpoint`.
- Gia lap merge `puyen` vao `main` hien co conflict trong `src/main.js`.

## File thay doi

```text
A public/model/japanese_maple.glb
A public/model/koi_fish.glb
M src/main.js
```

Thong ke:

```text
public/model/japanese_maple.glb | 4.34 MB
public/model/koi_fish.glb       | 5.01 MB
src/main.js                     | 970 changed lines
3 files changed, 839 insertions(+), 131 deletions(-)
```

## Noi dung chinh tren `puyen`

- Them model cay phong Nhat: `public/model/japanese_maple.glb`.
- Them model ca koi: `public/model/koi_fish.glb`.
- Them `sharedGLTFLoader = new GLTFLoader()` de dung chung loader.
- Them aquarium/pond vao scene:
  - `createAquarium()`
  - `animateAquarium(time)`
  - Ho nuoc bang geometry circle, mat nuoc transparent, shimmer, da vien, den point light.
  - Load 8 instance `koi_fish.glb`, gan du lieu boi random, animate ca theo quy dao.
- Them cay phong:
  - `createJapaneseMaple()`
  - Load `/model/japanese_maple.glb`, scale `0.2`, dat tai `(0, 0, 13.5)`.
- Goi `animateAquarium(elapsedTime)` trong loop `animate()`.
- Co nhieu thay doi formatting trong `src/main.js`, lam diff lon hon thay doi logic that.

## Diem can luu y truoc khi merge

- `src/main.js` conflict voi `main`, khong merge thang duoc.
- Branch `puyen` duoc tach tu commit cu hon, nen chua co 2 commit moi tren `main`.
- Code them mot so debug/global state:
  - `window.aquarium = group`
  - `window.debugTree = tree`
  - `console.log("TREE LOADED")`
  - `console.log(progress.loaded / progress.total)`
  - nhieu block keyboard debug dang comment.
- Asset GLB moi tang kich thuoc repo/build khoang 9.35 MB.
- Ho/ca/cay duoc them truc tiep vao scene ngay khi khoi dong, khong co toggle hoac lifecycle cleanup.
- `createAquarium()` load 8 lan cung mot file `koi_fish.glb`; nen can xem hieu nang tai lan dau va cache.
- Vi tri aquarium/cay dang hard-code quanh `(0, 0, 13.5)`, can check co trung model truong, camera, collision hay khong.
- Aquarium scale `0.05` nhung pond geometry ben trong scale lon, can xem truc tiep tren scene de chac kich thuoc/vi tri hop ly.

## De xuat merge

Nen cherry-pick/port thu cong cac phan co gia tri thay vi merge raw:

1. Lay 2 asset GLB neu thuc su can tinh nang ho ca va cay.
2. Dua `createAquarium`, `animateAquarium`, `createJapaneseMaple` vao `src/main.js` tren `main` hien tai bang patch thu cong.
3. Bo debug globals/logs/commented keyboard handlers truoc khi merge.
4. Giu cac thay doi hien co tren `main` ve mat troi/UI, vi merge raw se de conflict va co the lam lui cac chinh sua gan day.
5. Test lai `npm run build` va mo app de kiem tra vi tri ho, ca, cay, FPS va loading.

## Ket luan

Khong nen merge thang `puyen` vao `main` luc nay. Nen port co chon loc tinh nang pond/koi/maple sang `main`, vi diff co conflict, nhieu formatting noise va mot so debug code.
