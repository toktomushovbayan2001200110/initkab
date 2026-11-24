// Глобальные объекты, которые приходят из <script> тегов (three.js UMD 0.147) и из Django.
import type * as T from 'three';
import type { OrbitControls as OC } from 'three/examples/jsm/controls/OrbitControls';
import type * as BGU from 'three/examples/jsm/utils/BufferGeometryUtils';

declare global {
  const THREE: typeof T & { OrbitControls: typeof OC; BufferGeometryUtils: typeof BGU };
  namespace THREE {
    type Object3D = T.Object3D; type Mesh = T.Mesh; type Group = T.Group; type Vector3 = T.Vector3;
    type Material = T.Material; type BufferGeometry = T.BufferGeometry; type InstancedMesh = T.InstancedMesh;
  }
  interface Window { [key: string]: any; }
}
export {};

// Свойства DOM, к которым код обращается без приведения типов (постепенная типизация).
declare global {
  interface Element { dataset: DOMStringMap; style: CSSStyleDeclaration; onclick: any; oninput: any; onblur: any; value: any; }
  interface HTMLElement { value: any; checked: any; disabled: any; _h?: any; }
  interface EventTarget { checked?: any; tagName?: any; value?: any; textContent?: any; classList?: any; closest?: any; }
  /** Режим прогулки от первого лица (выставляется в window). */
  var fpvOn: boolean;
}
