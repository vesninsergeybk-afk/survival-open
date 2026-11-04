// Keep expanded services/upgrades/presets and scroll when a transaction redraws
// the station. Restore disclosure state before scroll to avoid height clamping.
export function captureHangarView(root){
 return {
  scroll:root.querySelector('.base-dialog')?.scrollTop||0,
  expanded:[...root.querySelectorAll('details[data-hangar-section][open]')]
   .map(node=>node.dataset.hangarSection)
 };
}
export function restoreHangarView(root,view){
 for(const node of root.querySelectorAll('details[data-hangar-section]'))
  node.open=view.expanded.includes(node.dataset.hangarSection);
 const dialog=root.querySelector('.base-dialog');if(dialog)dialog.scrollTop=view.scroll;
}
