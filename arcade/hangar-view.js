// Keep expanded services/upgrades/presets and scroll when a transaction redraws
// the station. Restore disclosure state before scroll to avoid height clamping.
export function captureHangarView(root){
 return {
  tab:root.querySelector('.base-tabs [aria-selected="true"]')?.dataset.role,
  section:root.querySelector('.development-tabs [aria-pressed="true"]')?.dataset.id||
   root.querySelector('.hg-view-nav [aria-pressed="true"]')?.dataset.id||'',
  scroll:root.querySelector('.base-dialog')?.scrollTop||0,
  expanded:[...root.querySelectorAll('details[data-hangar-section][open]')]
   .map(node=>node.dataset.hangarSection)
 };
}
export function restoreHangarView(root,view){
 for(const node of root.querySelectorAll('details[data-hangar-section]'))
  node.open=view.expanded.includes(node.dataset.hangarSection);
 const currentTab=root.querySelector('.base-tabs [aria-selected="true"]')?.dataset.role;
 const section=root.querySelector('.development-tabs [aria-pressed="true"]')?.dataset.id||
  root.querySelector('.hg-view-nav [aria-pressed="true"]')?.dataset.id||'';
 const dialog=root.querySelector('.base-dialog');
 if(dialog)dialog.scrollTop=view.tab===currentTab&&(view.section||'')===section?view.scroll:0;
}
