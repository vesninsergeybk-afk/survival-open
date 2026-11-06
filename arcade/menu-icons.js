// One line-art vocabulary for equipment, technologies and navigation.
// Labels carry meaning; these decorative symbols never replace action text.
const paths={
 plasma:'M12 6h8v12h-8z M16 1v9 M10 21h12 M12 18v9 M20 18v9',
 rail:'M12 12h8v15h-8z M13 1v15 M19 1v15 M9 24h14',
 flak:'M10 12h12v14H10z M10 3l3 11 M16 1v13 M22 3l-3 11 M7 22h18',
 rocket:'M8 7l4-6 4 6v18H8z M18 13l4-6 4 6v14h-8z M10 29h4 M20 30h4',
 resonator:'M5 8a4 4 0 1 0 8 0a4 4 0 1 0-8 0 M19 24a4 4 0 1 0 8 0a4 4 0 1 0-8 0 M11 11l10 10 M23 8L9 24',
 ion:'M10 12l6-10 6 10-6 16z M5 17h22 M16 10v12',
 howitzer:'M10 16h12v12H10z M12 2h8v16h-8z M6 23h20 M6 28h20',
 pulse:'M16 12a4 4 0 1 0 0 8a4 4 0 1 0 0-8 M8 8a11 11 0 0 0 0 16 M24 8a11 11 0 0 1 0 16 M4 4a17 17 0 0 0 0 24 M28 4a17 17 0 0 1 0 24',
 decoy:'M16 10v16 M10 27h12 M16 5a3 3 0 1 0 0 6a3 3 0 1 0 0-6 M9 4a10 10 0 0 0 0 14 M23 4a10 10 0 0 1 0 14',
 trap:'M4 9l12-6 12 6v14l-12 6-12-6z M4 9l12 7 12-7 M16 16v13 M10 13l6 3 6-3',
 jam:'M5 5l22 22 M4 12l5-5 M4 20l10-10 M8 24l11-11 M14 28l10-10 M22 26l6-6 M21 4l7 7',
 beam:'M16 4a12 12 0 1 0 0 24a12 12 0 1 0 0-24 M16 1v9 M16 22v9 M1 16h9 M22 16h9',
 double:'M4 16h10 M14 16L26 5 M14 16l12 11 M21 5h5v5 M21 27h5v-5',
 range:'M3 16h26 M3 16l5-5 M3 16l5 5 M29 16l-5-5 M29 16l-5 5 M11 5h10 M11 27h10',
 hull:'M10 3h12l6 13-6 13H10L4 16z M10 3v26 M22 3v26 M4 16h24',
 engine:'M11 4h10v15H11z M8 19h16 M11 23l-2 6 M16 23v8 M21 23l2 6',
 shield:'M16 3l11 5v8c0 7-11 13-11 13S5 23 5 16V8z M16 9v14 M10 16h12',
 network:'M5 7h7v7H5z M21 7h7v7h-7z M13 23h7v7h-7z M12 10h9 M8 14l8 9 M25 14l-8 9',
 map:'M3 7l8-3 10 3 8-3v21l-8 3-10-3-8 3z M11 4v21 M21 7v21',
 navigation:'M16 3l11 25-11-6-11 6z M16 3v19',
 repair:'M19 4a8 8 0 0 0-9 10L3 24l5 5 10-10a8 8 0 0 0 10-9l-6 6-6-6 6-6z',
 drones:'M11 10h10v12H11z M16 3v7 M16 22v7 M3 9l8 5 M21 14l8-5 M3 25l8-7 M21 18l8 7',
 upgrades:'M16 3l10 10h-6v15h-8V13H6z',
 weapons:'M8 27l5-10 M19 17l5 10 M12 4h8v13h-8z M16 1v9'
};
const stationWeaponArtwork=new Set(['plasma','rail','flak','rocket','resonator','ion','howitzer']);
export function menuIcon(id,css='menu-symbol'){
 if(css==='hg-module-icon'&&stationWeaponArtwork.has(id)){
  return '<svg class="'+css+' station-weapon-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="./studio/menu-kit/art/ui/icons.svg#weapon-'+id+'"/></svg>';
 }
 return '<svg class="'+css+'" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="'+(paths[id]||paths.upgrades)+'"/></svg>';
}
