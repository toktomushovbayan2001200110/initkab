"""Export Azamat for the web 3D model (three.js): one GLB with flat colour textures and the S01_* clips.
Run headless so the .blend is never saved:
  blender -b "D:/BNT/БЛЕНДЕР/NPC/Student01_Azamat.blend" --python "D:/BNT/БЛЕНДЕР/NPC/export_web_glb.py"
Output: D:/BNT/БЛЕНДЕР/NPC/web/azamat.glb + web/report.json"""
import bpy, os, json, math

SRC = r"D:/BNT/БЛЕНДЕР/NPC/student01_export_ue.py"
OUT_WEB = r"D:/BNT/БЛЕНДЕР/NPC/web"
TEX = 512                     # texture size for the web
TARGET_TRIS = 16000           # whole character
os.makedirs(OUT_WEB, exist_ok=True)

# 1. reuse the UE exporter's accessory skinning and material flattening (everything before the FBX part)
code = open(SRC, encoding="utf-8").read()
code = code.split("# switch subdivision off")[0]
code = code.replace(r'OUT = r"D:\BNT\UnrealProjects\Corpus4VR_Source\npc\azamat"', 'OUT = r"%s/_tex"' % OUT_WEB)
code = code.replace("MAX_TEX = 2048", "MAX_TEX = %d" % (TEX * 2))
g = {"__name__": "__web__"}
exec(compile(code, SRC, "exec"), g)
RIG, meshes, manifest, OUT = g["RIG"], g["meshes"], g["manifest"], g["OUT"]

# 2. replace every material with a plain Principled one using the flattened colour texture
for o in meshes:
    for i, m in enumerate(o.data.materials):
        if not m or m.name not in manifest:
            continue
        info = manifest[m.name]
        nm = bpy.data.materials.new("W_" + m.name)
        nm.use_nodes = True
        nt = nm.node_tree
        b = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
        im = bpy.data.images.load(os.path.join(OUT, info["tex"]))
        if max(im.size) > TEX:
            s = TEX / max(im.size)
            im.scale(max(4, int(im.size[0] * s)), max(4, int(im.size[1] * s)))
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = im
        nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
        if info.get("masked"):
            nt.links.new(t.outputs["Alpha"], b.inputs["Alpha"])
            nm.blend_method = "CLIP" if hasattr(nm, "blend_method") else None
        b.inputs["Roughness"].default_value = float(info.get("rough", 0.6))
        b.inputs["Metallic"].default_value = float(info.get("metal", 0.0))
        nm.use_backface_culling = not info.get("two_sided", False)
        o.data.materials[i] = nm

# 3. subdivision off, then decimate everything to the web budget
for o in meshes:
    for md in o.modifiers:
        if md.type == "SUBSURF":
            md.show_viewport = md.show_render = False
bpy.context.view_layer.update()

def count_tris():
    dg = bpy.context.evaluated_depsgraph_get()
    n, per = 0, {}
    for o in meshes:
        me = o.evaluated_get(dg).to_mesh()
        me.calc_loop_triangles()
        per[o.name] = len(me.loop_triangles)
        n += per[o.name]
        o.evaluated_get(dg).to_mesh_clear()
    return n, per

before, per = count_tris()
ratio = min(1.0, TARGET_TRIS / max(1, before))
if ratio < 0.98:
    for o in meshes:
        if per[o.name] < 300 or any(k in o.name.lower() for k in ("eye", "brow", "lash", "teeth", "tongue")):
            continue
        d = o.modifiers.new("_web_decimate", "DECIMATE")
        d.ratio = max(0.08, ratio)
        arm = [i for i, m in enumerate(o.modifiers) if m.type == "ARMATURE"]
        o.modifiers.move(len(o.modifiers) - 1, (arm[0] + 1) if arm else 0)
    bpy.context.view_layer.update()
after, per = count_tris()

# 4. clips
acts = [a for a in bpy.data.actions if a.name.startswith("S01_")]
for a in acts:
    a.use_fake_user = True
RIG.animation_data.action = None
for pb in RIG.pose.bones:
    pb.rotation_mode = "QUATERNION"
    pb.rotation_quaternion = (1, 0, 0, 0)
    pb.location = (0, 0, 0)
tr = RIG.animation_data.nla_tracks
for t in list(tr):
    tr.remove(t)
for a in acts:                 # one NLA track per action, so the exporter writes each clip by name
    t = tr.new()
    t.name = a.name
    t.strips.new(a.name, int(a.frame_range[0]), a)
    t.mute = True

# 5. export
bpy.ops.object.select_all(action="DESELECT")
for o in meshes + [RIG]:
    o.hide_set(False)
    o.hide_viewport = False
    o.select_set(True)
bpy.context.view_layer.objects.active = RIG
glb = os.path.join(OUT_WEB, "azamat.glb")
bpy.ops.export_scene.gltf(
    filepath=glb, export_format="GLB", use_selection=True, export_apply=True,
    export_animations=True, export_animation_mode="NLA_TRACKS", export_force_sampling=True,
    export_frame_step=2, export_optimize_animation_size=True, export_def_bones=True,
    export_image_format="JPEG", export_jpeg_quality=82, export_skins=True, export_morph=False,
    export_yup=True, export_texcoords=True, export_normals=True, export_tangents=False)

rep = {"glb": glb, "mb": round(os.path.getsize(glb) / 1e6, 2), "tris_before": before, "tris_after": after,
       "per_mesh": per, "bones": len(RIG.data.bones),
       "deform_bones": sum(1 for b in RIG.data.bones if b.use_deform),
       "actions": [(a.name, list(a.frame_range)) for a in acts], "materials": len(manifest),
       "height_m": round(max((RIG.matrix_world @ b.tail_local).z for b in RIG.data.bones), 3)}
json.dump(rep, open(os.path.join(OUT_WEB, "report.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("WEB_EXPORT", json.dumps(rep, ensure_ascii=False))
# the .blend is not saved: run with -b and quit
