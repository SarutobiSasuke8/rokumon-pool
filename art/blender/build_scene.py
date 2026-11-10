"""Rokumon Pool: table scene, built by script and rendered for the game.

Run with Blender (5.x), never system Python:

  blender --background --python art/blender/build_scene.py -- table
  blender --background --python art/blender/build_scene.py -- hero [name] [width] [height]
  blender --background --python art/blender/build_scene.py -- save

  table  top-down orthographic render of the empty table, exactly covering the
         game's 960x540 view, written to src/art/table.webp
  hero   perspective key art with balls and cue, written to art/renders/
  save   write art/blender/rokumon_pool_table.blend for opening in the UI

Add `draft` as a last argument for a fast low-sample render.

Every measurement below is in game pixels and mirrors src/game/constants.js
(TABLE, BALL). If those change, change them here and re-render, or the
picture and the physics will disagree. One game pixel is S metres.
"""
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Euler, Vector

# ---- mirrors src/game/constants.js ---------------------------------------
VIEW_W, VIEW_H = 960, 540
LEFT, RIGHT, TOP, BOTTOM = 80, 880, 80, 460
MID_X, MID_Y = 480, 270
POCKET_R = 20
BALL_R = 11
HEAD_X = LEFT + (RIGHT - LEFT) * 0.25
FOOT_X = LEFT + (RIGHT - LEFT) * 0.62
BALL_COLORS = {
    1: 0xF5C518, 2: 0x2563EB, 3: 0xDC2626, 4: 0x7C3AED, 5: 0xF97316, 6: 0x22C55E, 7: 0x8B1E1E,
    8: 0x111111,
    9: 0xF5C518, 10: 0x2563EB, 11: 0xDC2626, 12: 0x7C3AED, 13: 0xF97316, 14: 0x22C55E, 15: 0x8B1E1E,
}
RACK = [[1], [9, 2], [10, 8, 3], [11, 4, 12, 5], [13, 6, 14, 7, 15]]

# ---- art measurements (game px unless noted) ------------------------------
S = 0.003               # metres per game pixel
FRAME = 40              # outer edge of the rails, px from the view edge
CUSHION = 16            # depth of a cushion from nose to rail
CORNER_R = 16           # rounding of the table's outer corners
RAIL_Z = 0.047          # height of the rail top above the cloth, metres
NOSE_Z = 0.040
FLOOR_Z = -0.80

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def P(x, y, z=0.0):
    """Game pixel (x right, y down) to Blender metres (x right, y up)."""
    return Vector(((x - VIEW_W / 2) * S, -(y - VIEW_H / 2) * S, z))


def lin(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def rgb(hex_color):
    return (lin((hex_color >> 16) & 255), lin((hex_color >> 8) & 255), lin(hex_color & 255), 1.0)


# ---- materials --------------------------------------------------------------

def new_mat(name):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes["Principled BSDF"]
    return mat, nodes, mat.node_tree.links, bsdf


def set_in(bsdf, name, value):
    if name in bsdf.inputs:
        bsdf.inputs[name].default_value = value


def mat_cloth(name="Cloth", tone=1.0):
    mat, nodes, links, bsdf = new_mat(name)
    coord = nodes.new("ShaderNodeTexCoord")
    fine = nodes.new("ShaderNodeTexNoise")
    fine.inputs["Scale"].default_value = 900
    fine.inputs["Detail"].default_value = 6
    broad = nodes.new("ShaderNodeTexNoise")
    broad.inputs["Scale"].default_value = 3.2
    broad.inputs["Detail"].default_value = 3
    links.new(coord.outputs["Object"], fine.inputs["Vector"])
    links.new(coord.outputs["Object"], broad.inputs["Vector"])
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.3
    ramp.color_ramp.elements[0].color = (0.0050 * tone, 0.088 * tone, 0.030 * tone, 1)
    ramp.color_ramp.elements[1].position = 0.7
    ramp.color_ramp.elements[1].color = (0.0075 * tone, 0.112 * tone, 0.040 * tone, 1)
    mix = nodes.new("ShaderNodeMix")
    mix.data_type = "FLOAT"
    mix.inputs[0].default_value = 0.88
    links.new(broad.outputs["Fac"], mix.inputs[2])
    links.new(fine.outputs["Fac"], mix.inputs[3])
    links.new(mix.outputs[0], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.12
    bump.inputs["Distance"].default_value = 0.0006
    links.new(fine.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    set_in(bsdf, "Roughness", 0.95)
    set_in(bsdf, "Sheen Weight", 0.5)
    set_in(bsdf, "Sheen Roughness", 0.5)
    set_in(bsdf, "Specular IOR Level", 0.15)
    return mat


def mat_wood(name, along="X", dark=(0.035, 0.012, 0.006), light=(0.19, 0.07, 0.026)):
    """Polished hardwood with the grain running along one object axis."""
    mat, nodes, links, bsdf = new_mat(name)
    coord = nodes.new("ShaderNodeTexCoord")
    mapping = nodes.new("ShaderNodeMapping")
    stretch = (0.9, 14.0, 14.0) if along == "X" else (14.0, 0.9, 14.0)
    mapping.inputs["Scale"].default_value = stretch
    links.new(coord.outputs["Object"], mapping.inputs["Vector"])
    grain = nodes.new("ShaderNodeTexNoise")
    grain.inputs["Scale"].default_value = 9
    grain.inputs["Detail"].default_value = 9
    grain.inputs["Roughness"].default_value = 0.62
    if "Distortion" in grain.inputs:
        grain.inputs["Distortion"].default_value = 0.6
    links.new(mapping.outputs["Vector"], grain.inputs["Vector"])
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.32
    ramp.color_ramp.elements[0].color = (*dark, 1)
    ramp.color_ramp.elements[1].position = 0.72
    ramp.color_ramp.elements[1].color = (*light, 1)
    links.new(grain.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    set_in(bsdf, "Roughness", 0.32)
    set_in(bsdf, "Coat Weight", 0.5)
    set_in(bsdf, "Coat Roughness", 0.12)
    return mat


def mat_plain(name, color, roughness=0.5, metallic=0.0, coat=0.0, emission=0.0):
    mat, nodes, links, bsdf = new_mat(name)
    set_in(bsdf, "Base Color", color)
    set_in(bsdf, "Roughness", roughness)
    set_in(bsdf, "Metallic", metallic)
    set_in(bsdf, "Coat Weight", coat)
    if emission:
        set_in(bsdf, "Emission Color", color)
        set_in(bsdf, "Emission Strength", emission)
    return mat


def mat_floor():
    mat, nodes, links, bsdf = new_mat("Floor")
    coord = nodes.new("ShaderNodeTexCoord")
    brick = nodes.new("ShaderNodeTexBrick")
    brick.inputs["Scale"].default_value = 2.2
    brick.inputs["Mortar Size"].default_value = 0.004
    brick.inputs["Color1"].default_value = (0.020, 0.016, 0.014, 1)
    brick.inputs["Color2"].default_value = (0.034, 0.026, 0.021, 1)
    brick.inputs["Mortar"].default_value = (0.004, 0.004, 0.004, 1)
    brick.inputs["Brick Width"].default_value = 1.6
    brick.inputs["Row Height"].default_value = 0.22
    links.new(coord.outputs["Object"], brick.inputs["Vector"])
    links.new(brick.outputs["Color"], bsdf.inputs["Base Color"])
    set_in(bsdf, "Roughness", 0.42)
    return mat


def mat_ball(number):
    """Pool ball: colour, stripe band and two white number discs, all from
    object coordinates so no image textures are needed."""
    mat, nodes, links, bsdf = new_mat(f"Ball{number}")
    white = (0.90, 0.87, 0.78, 1)
    if number == 0:
        set_in(bsdf, "Base Color", white)
    else:
        coord = nodes.new("ShaderNodeTexCoord")
        sep = nodes.new("ShaderNodeSeparateXYZ")
        links.new(coord.outputs["Object"], sep.inputs[0])

        def beyond(axis, limit):
            ab = nodes.new("ShaderNodeMath")
            ab.operation = "ABSOLUTE"
            links.new(sep.outputs[axis], ab.inputs[0])
            gt = nodes.new("ShaderNodeMath")
            gt.operation = "GREATER_THAN"
            gt.inputs[1].default_value = limit
            links.new(ab.outputs[0], gt.inputs[0])
            return gt.outputs[0]

        colour = nodes.new("ShaderNodeRGB")
        colour.outputs[0].default_value = rgb(BALL_COLORS[number])
        band = nodes.new("ShaderNodeMix")
        band.data_type = "RGBA"
        band.inputs[6].default_value = rgb(BALL_COLORS[number])
        band.inputs[7].default_value = white
        if number > 8:
            links.new(beyond("Y", 0.52 * BALL_R * S), band.inputs[0])
        else:
            band.inputs[0].default_value = 0.0
        disc = nodes.new("ShaderNodeMix")
        disc.data_type = "RGBA"
        links.new(band.outputs[2], disc.inputs[6])
        disc.inputs[7].default_value = white
        links.new(beyond("Z", 0.84 * BALL_R * S), disc.inputs[0])
        links.new(disc.outputs[2], bsdf.inputs["Base Color"])
    set_in(bsdf, "Roughness", 0.06)
    set_in(bsdf, "Coat Weight", 1.0)
    set_in(bsdf, "Coat Roughness", 0.03)
    return mat


# ---- mesh helpers -----------------------------------------------------------

def add_object(name, mesh, mat=None, smooth=False):
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    if mat:
        obj.data.materials.append(mat)
    if smooth:
        for poly in mesh.polygons:
            poly.use_smooth = True
    return obj


def prism(name, pts, z0, z1, mat, bevel=0.0):
    """Vertical prism over a polygon given in game pixels."""
    bm = bmesh.new()
    lower = [bm.verts.new(P(x, y, z0)) for x, y in pts]
    upper = [bm.verts.new(P(x, y, z1)) for x, y in pts]
    n = len(pts)
    bm.faces.new(lower)
    bm.faces.new(list(reversed(upper)))
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((lower[j], lower[i], upper[i], upper[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = add_object(name, mesh, mat)
    if bevel:
        mod = obj.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 3
        mod.limit_method = "ANGLE"
        mod.angle_limit = math.radians(40)
        for poly in mesh.polygons:
            poly.use_smooth = True
        wn = obj.modifiers.new("Normals", "WEIGHTED_NORMAL")
        wn.keep_sharp = True
    return obj


def cylinder(name, x, y, radius_px, z0, z1, mat, segments=64, cap=True):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=cap, segments=segments, radius1=radius_px * S, radius2=radius_px * S, depth=z1 - z0)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = add_object(name, mesh, mat)
    obj.location = P(x, y, (z0 + z1) / 2)
    return obj


def cut(target, cutter):
    mod = target.modifiers.new("Cut", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.object = cutter
    mod.solver = "EXACT"


def pockets():
    return [(LEFT, TOP), (MID_X, TOP), (RIGHT, TOP), (LEFT, BOTTOM), (MID_X, BOTTOM), (RIGHT, BOTTOM)]


def cushion(name, nose_a, nose_b, back_a, back_b, mat):
    """A cushion swept between two mitred ends. The section runs from the
    nose (overhanging, just above ball centre) back and up to the rail."""
    section = [(0.0, NOSE_Z), (0.0, NOSE_Z - 0.011), (0.42, 0.0), (1.0, 0.0), (1.0, RAIL_Z - 0.002), (0.3, NOSE_Z + 0.004)]
    bm = bmesh.new()
    rings = []
    for nose, back in ((nose_a, back_a), (nose_b, back_b)):
        ring = []
        for t, z in section:
            x = nose[0] + (back[0] - nose[0]) * t
            y = nose[1] + (back[1] - nose[1]) * t
            ring.append(bm.verts.new(P(x, y, z)))
        rings.append(ring)
    n = len(section)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((rings[0][i], rings[0][j], rings[1][j], rings[1][i]))
    bm.faces.new(rings[0])
    bm.faces.new(list(reversed(rings[1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = add_object(name, mesh, mat)
    mod = obj.modifiers.new("Bevel", "BEVEL")
    mod.width = 0.0025
    mod.segments = 3
    for poly in mesh.polygons:
        poly.use_smooth = True
    wn = obj.modifiers.new("Normals", "WEIGHTED_NORMAL")
    wn.keep_sharp = True
    return obj


def arc(cx, cy, r, a0, a1, steps=8):
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / steps)), cy + r * math.sin(math.radians(a0 + (a1 - a0) * i / steps))) for i in range(steps + 1)]


def sector(cx, cy, r0, r1, a0, a1, steps=28):
    outer = arc(cx, cy, r1, a0, a1, steps)
    inner = arc(cx, cy, r0, a1, a0, steps)
    return outer + inner


# ---- the table --------------------------------------------------------------

def build_table():
    cloth = mat_cloth()
    cushion_cloth = mat_cloth("CushionCloth", 0.72)
    wood_x = mat_wood("RailWoodX", "X")
    wood_y = mat_wood("RailWoodY", "Y")
    body_wood = mat_wood("BodyWood", "X", dark=(0.018, 0.007, 0.004), light=(0.08, 0.03, 0.012))
    leather = mat_plain("PocketLeather", (0.006, 0.0055, 0.005, 1), roughness=0.55, coat=0.2)
    liner = mat_plain("PocketLiner", (0.004, 0.004, 0.004, 1), roughness=0.85)
    pearl = mat_plain("Sight", (0.85, 0.80, 0.66, 1), roughness=0.25, coat=0.6)

    f = FRAME
    inner = LEFT - CUSHION          # 64: where cushion meets rail
    x0, x1, y0, y1 = f, VIEW_W - f, f, VIEW_H - f
    ix0, ix1, iy0, iy1 = inner, VIEW_W - inner, inner, VIEW_H - inner
    r = CORNER_R

    # Cloth bed: a slab under the cushions, holed at the pockets.
    bed = prism("ClothBed", [(ix0 - 2, iy0 - 2), (ix1 + 2, iy0 - 2), (ix1 + 2, iy1 + 2), (ix0 - 2, iy1 + 2)], -0.02, 0.0, cloth)

    # Rails: four mitred lengths so the grain follows each one.
    tl = arc(x0 + r, y0 + r, r, 225, 270, 5)
    tr = arc(x1 - r, y0 + r, r, 270, 315, 5)
    rt = arc(x1 - r, y0 + r, r, 315, 360, 5)
    rb = arc(x1 - r, y1 - r, r, 0, 45, 5)
    br = arc(x1 - r, y1 - r, r, 45, 90, 5)
    bl = arc(x0 + r, y1 - r, r, 90, 135, 5)
    lb = arc(x0 + r, y1 - r, r, 135, 180, 5)
    lt = arc(x0 + r, y0 + r, r, 180, 225, 5)
    rails = [
        prism("RailTop", tl + tr + [(ix1, iy0), (ix0, iy0)], -0.03, RAIL_Z, wood_x, bevel=0.004),
        prism("RailRight", rt + rb + [(ix1, iy1), (ix1, iy0)], -0.03, RAIL_Z, wood_y, bevel=0.004),
        prism("RailBottom", br + bl + [(ix0, iy1), (ix1, iy1)], -0.03, RAIL_Z, wood_x, bevel=0.004),
        prism("RailLeft", lb + lt + [(ix0, iy0), (ix0, iy1)], -0.03, RAIL_Z, wood_y, bevel=0.004),
    ]

    apron = prism("Apron", [(x0 + 5, y0 + 5), (x1 - 5, y0 + 5), (x1 - 5, y1 - 5), (x0 + 5, y1 - 5)], -0.26, -0.03, body_wood, bevel=0.006)

    # Cushions: noses on the physics bounds, gapped POCKET_R either side of
    # each pocket, ends flared open towards the table.
    pr = POCKET_R
    cf, sf = 6, 5   # how far the back edge runs past the nose at corner and side pockets
    cushion("CushionTopL", (LEFT + pr, TOP), (MID_X - pr, TOP), (LEFT + pr - cf, iy0), (MID_X - pr + sf, iy0), cushion_cloth)
    cushion("CushionTopR", (MID_X + pr, TOP), (RIGHT - pr, TOP), (MID_X + pr - sf, iy0), (RIGHT - pr + cf, iy0), cushion_cloth)
    cushion("CushionBotL", (LEFT + pr, BOTTOM), (MID_X - pr, BOTTOM), (LEFT + pr - cf, iy1), (MID_X - pr + sf, iy1), cushion_cloth)
    cushion("CushionBotR", (MID_X + pr, BOTTOM), (RIGHT - pr, BOTTOM), (MID_X + pr - sf, iy1), (RIGHT - pr + cf, iy1), cushion_cloth)
    cushion("CushionLeft", (LEFT, TOP + pr), (LEFT, BOTTOM - pr), (ix0, TOP + pr - cf), (ix0, BOTTOM - pr + cf), cushion_cloth)
    cushion("CushionRight", (RIGHT, TOP + pr), (RIGHT, BOTTOM - pr), (ix1, TOP + pr - cf), (ix1, BOTTOM - pr + cf), cushion_cloth)

    # Pockets: a hole through bed and rails, a dark cup below, and a leather
    # surround on the rail.
    for i, (px, py) in enumerate(pockets()):
        cutter = cylinder(f"PocketCut{i}", px, py, pr + 1.2, -0.2, 0.2, None, cap=True)
        cutter.hide_render = True
        cutter.display_type = "WIRE"
        cut(bed, cutter)
        cut(apron, cutter)
        for rail in rails:
            cut(rail, cutter)
        cylinder(f"PocketCup{i}", px, py, pr + 1.4, -0.16, 0.0, liner, cap=False)
        cylinder(f"PocketFloor{i}", px, py, pr + 1.4, -0.165, -0.16, liner)
        corner = px != MID_X
        if corner:
            sx = 1 if px < MID_X else -1
            sy = 1 if py < MID_Y else -1
            # Mouth faces the table's centre; the surround wraps the rest.
            mouth = math.degrees(math.atan2(sy, sx))
            span = 76
            pts = sector(px, py, pr + 1.0, pr + 15, mouth + span, mouth + 360 - span)
        else:
            mouth = 90 if py < MID_Y else 270
            span = 90
            pts = sector(px, py, pr + 1.0, pr + 12, mouth + span, mouth + 360 - span)
        surround = prism(f"PocketSurround{i}", pts, RAIL_Z - 0.006, RAIL_Z + 0.0025, leather, bevel=0.0018)
        cut(surround, cutter)
        # The leather back of the pocket, from the cloth up to the rail.
        prism(f"PocketBack{i}", sector(px, py, pr + 0.6, pr + 2.2, mouth + span - 14, mouth + 360 - span + 14), -0.02, RAIL_Z - 0.001, leather)

    # Sights: pearl diamonds along the rails.
    w, h = RIGHT - LEFT, BOTTOM - TOP
    mid_rail = (f + inner) / 2
    def diamond(name, cx, cy, horizontal):
        a, b = (3.4, 2.0) if horizontal else (2.0, 3.4)
        prism(name, [(cx - a, cy), (cx, cy - b), (cx + a, cy), (cx, cy + b)], RAIL_Z - 0.002, RAIL_Z + 0.0006, pearl)
    for i in range(1, 8):
        if i == 4:
            continue
        x = LEFT + w * i / 8
        diamond(f"SightT{i}", x, mid_rail, True)
        diamond(f"SightB{i}", x, VIEW_H - mid_rail, True)
    for i in range(1, 4):
        y = TOP + h * i / 4
        diamond(f"SightL{i}", mid_rail, y, False)
        diamond(f"SightR{i}", VIEW_W - mid_rail, y, False)

    # Body and legs, for any camera that sees the table from the side.
    for lx in (x0 + 60, x1 - 60):
        for ly in (y0 + 50, y1 - 50):
            prism(f"Leg{lx}{ly}", [(lx - 24, ly - 24), (lx + 24, ly - 24), (lx + 24, ly + 24), (lx - 24, ly + 24)], FLOOR_Z, -0.26, body_wood, bevel=0.01)

    # Floor.
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=9)
    mesh = bpy.data.meshes.new("Floor")
    bm.to_mesh(mesh)
    bm.free()
    floor = add_object("Floor", mesh, mat_floor())
    floor.location = (0, 0, FLOOR_Z)


def add_light(name, kind, location, energy, color=(1, 1, 1), size=1.0, size_y=None, rotation=(0, 0, 0)):
    data = bpy.data.lights.new(name, kind)
    data.energy = energy
    data.color = color
    if kind == "AREA":
        data.shape = "RECTANGLE" if size_y else "SQUARE"
        data.size = size
        if size_y:
            data.size_y = size_y
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    obj.rotation_euler = rotation
    bpy.context.scene.collection.objects.link(obj)
    return obj


def lights(strength=1.0, fill=1.0):
    # The lamp over the table: long, warm, close enough to pool the light.
    add_light("TableLamp", "AREA", (0, 0, 1.15), 46 * strength, color=(1.0, 0.93, 0.82), size=2.1, size_y=0.75)
    # A cool, weak fill so the far rails and the floor do not go to black.
    add_light("RoomFill", "AREA", (0, 0, 2.6), 14 * strength * fill, color=(0.72, 0.82, 1.0), size=6.0)


# ---- balls and cue (hero only) ------------------------------------------------

def add_ball(number, x, y, rng, look_at=None):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=24, radius=BALL_R * S)
    mesh = bpy.data.meshes.new(f"Ball{number}")
    bm.to_mesh(mesh)
    bm.free()
    obj = add_object(f"Ball{number}", mesh, mat_ball(number), smooth=True)
    obj.location = P(x, y, BALL_R * S)
    if number:
        ink = mat_plain(f"Ink{number}", (0.004, 0.004, 0.004, 1), roughness=0.2, coat=1.0)
        for side in (1, -1):
            curve = bpy.data.curves.new(f"Num{number}{side}", "FONT")
            curve.body = str(number)
            curve.align_x = "CENTER"
            curve.align_y = "CENTER"
            curve.size = BALL_R * S * (0.6 if number > 9 else 0.78)
            curve.offset = BALL_R * S * 0.03   # thicken the strokes
            text = bpy.data.objects.new(f"Num{number}{side}", curve)
            bpy.context.scene.collection.objects.link(text)
            text.data.materials.append(ink)
            text.parent = obj
            text.location = (0, 0, side * BALL_R * S * 1.002)
            if side < 0:
                text.rotation_euler = (math.pi, 0, 0)
            wrap = text.modifiers.new("Wrap", "SHRINKWRAP")
            wrap.target = obj
            wrap.offset = 0.00012
        # Numbers face roughly up and towards the camera, never perfectly.
        if look_at is None:
            obj.rotation_euler = Euler((rng.uniform(-0.75, 0.2), rng.uniform(-0.6, 0.6), rng.uniform(0, math.tau)))
        else:
            # Turn a number disc towards the camera, then knock it off true so
            # no two balls sit alike.
            facing = (Vector(look_at) - obj.location).to_track_quat("Z", "Y")
            wobble = Euler((rng.uniform(-0.55, 0.3), rng.uniform(-0.45, 0.45), rng.uniform(-0.5, 0.5))).to_quaternion()
            obj.rotation_mode = "QUATERNION"
            obj.rotation_quaternion = facing @ wobble
    return obj


def add_cue(tip_x, tip_y, angle_deg, lift_deg=5.0):
    """A cue with its tip at the given game point, pointing along angle_deg
    (game angle, 0 = towards +x), butt raised by lift_deg."""
    length = 1.47
    sections = [
        # (start fraction, end fraction, radius start, radius end, colour, roughness)
        (0.000, 0.012, 0.0150, 0.0155, (0.01, 0.01, 0.01, 1), 0.7),
        (0.012, 0.200, 0.0155, 0.0148, (0.018, 0.008, 0.005, 1), 0.25),
        (0.200, 0.205, 0.0149, 0.0149, (0.75, 0.50, 0.14, 1), 0.3),
        (0.205, 0.400, 0.0148, 0.0132, (0.72, 0.68, 0.58, 1), 0.8),
        (0.400, 0.405, 0.0133, 0.0133, (0.75, 0.50, 0.14, 1), 0.3),
        (0.405, 0.580, 0.0132, 0.0112, (0.16, 0.035, 0.014, 1), 0.25),
        (0.580, 0.585, 0.0113, 0.0113, (0.75, 0.50, 0.14, 1), 0.3),
        (0.585, 0.982, 0.0112, 0.0066, (0.72, 0.52, 0.27, 1), 0.3),
        (0.982, 0.995, 0.0066, 0.0065, (0.90, 0.88, 0.82, 1), 0.3),
        (0.995, 1.000, 0.0065, 0.0060, (0.05, 0.16, 0.38, 1), 0.9),
    ]
    root = bpy.data.objects.new("Cue", None)
    bpy.context.scene.collection.objects.link(root)
    for i, (a, b, r0, r1, colour, rough) in enumerate(sections):
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=40, radius1=r0, radius2=r1, depth=(b - a) * length)
        mesh = bpy.data.meshes.new(f"CuePart{i}")
        bm.to_mesh(mesh)
        bm.free()
        metal = 1.0 if colour[0] > 0.7 and colour[2] < 0.2 else 0.0
        part = add_object(f"CuePart{i}", mesh, mat_plain(f"CueMat{i}", colour, roughness=rough, metallic=metal, coat=0.6 if rough < 0.4 else 0.0), smooth=True)
        part.parent = root
        # The cone's axis is Z; lay the cue along +X with the tip at the origin.
        part.rotation_euler = (0, math.pi / 2, 0)
        part.location = (-(1 - (a + b) / 2) * length, 0, 0)
    root.location = P(tip_x, tip_y, BALL_R * S * 1.05)
    root.rotation_euler = Euler((0, math.radians(lift_deg), -math.radians(angle_deg)), "ZYX")
    return root


def scatter_balls(rng):
    """A break in progress: the rack opening up, the cue ball arriving."""
    pitch = BALL_R * 2 + 1
    placed = []
    for row_i, row in enumerate(RACK):
        for i, number in enumerate(row):
            x = FOOT_X + row_i * pitch * math.cos(math.pi / 6)
            y = MID_Y + (i - row_i / 2) * pitch
            # Push each ball out from the rack's centre, the back rows furthest.
            cx, cy = FOOT_X + 2 * pitch, MID_Y
            dx, dy = x - cx, y - cy
            spread = 1.0 + rng.uniform(0.25, 1.5)
            placed.append((number, cx + dx * spread + rng.uniform(-10, 10), cy + dy * spread + rng.uniform(-10, 10)))
    out = []
    for number, x, y in placed:
        x = min(max(x, LEFT + BALL_R + 2), RIGHT - BALL_R - 2)
        y = min(max(y, TOP + BALL_R + 2), BOTTOM - BALL_R - 2)
        for _ in range(40):
            clash = [o for o in out if math.hypot(o[1] - x, o[2] - y) < BALL_R * 2 + 1]
            if not clash:
                break
            o = clash[0]
            d = math.hypot(x - o[1], y - o[2]) or 1.0
            x += (x - o[1]) / d * 4
            y += (y - o[2]) / d * 4
        out.append((number, x, y))
    return out


def build_room(sign_y=1.2, sign_z=0.47, ring_r=0.105):
    """What the hero camera sees beyond the table: a dark panelled wall, a
    glowing six-coin sign and a few warm lights to fall out of focus."""
    wall = mat_wood("WallWood", "X", dark=(0.012, 0.006, 0.004), light=(0.05, 0.022, 0.012))
    back_x = (RIGHT + 620 - VIEW_W / 2) * S
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    mesh = bpy.data.meshes.new("BackWall")
    bm.to_mesh(mesh)
    bm.free()
    back = add_object("BackWall", mesh, wall)
    back.scale = (0.1, 14.0, 4.0)
    back.location = (back_x, 0, FLOOR_Z + 2.0)
    side = add_object("SideWall", mesh.copy(), wall)
    side.scale = (14.0, 0.1, 4.0)
    side.location = (0, 3.4, FLOOR_Z + 2.0)
    near = add_object("NearWall", mesh.copy(), wall)
    near.scale = (14.0, 0.1, 4.0)
    near.location = (0, -3.4, FLOOR_Z + 2.0)

    # Rokumon sign: six rings in two rows of three, lit from within.
    glow = mat_plain("SignGlow", (1.0, 0.5, 0.12, 1), roughness=0.4, emission=6.0)
    gap = ring_r * 2.5
    for row in range(2):
        for col in range(3):
            bm = bmesh.new()
            bmesh.ops.create_circle(bm, segments=48, radius=ring_r)
            mesh = bpy.data.meshes.new("SignRing")
            bm.to_mesh(mesh)
            bm.free()
            # A torus from a circle: skin it with a curve-free approach.
            ring = add_object(f"SignRing{row}{col}", mesh, glow)
            ring.modifiers.new("Skin", "SKIN")
            for v in ring.data.skin_vertices[0].data:
                v.radius = (ring_r * 0.21, ring_r * 0.21)
            sub = ring.modifiers.new("Subsurf", "SUBSURF")
            sub.levels = 2
            sub.render_levels = 2
            ring.rotation_euler = (0, math.pi / 2, 0)
            ring.location = (back_x - 0.12, sign_y + (col - 1) * gap, sign_z + (0.5 - row) * gap)

    # Bar lights along the walls, far enough back to blur.
    for i, (y, z, colour) in enumerate([(-0.9, 0.34, (1.0, 0.45, 0.12)), (-0.2, 0.62, (1.0, 0.6, 0.25)), (0.35, 0.3, (0.9, 0.22, 0.12)), (2.25, 0.55, (1.0, 0.5, 0.18)), (2.75, 0.3, (0.9, 0.25, 0.1)), (-1.6, 0.6, (1.0, 0.55, 0.2))]):
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=8, radius=0.04)
        mesh = bpy.data.meshes.new(f"BarLight{i}")
        bm.to_mesh(mesh)
        bm.free()
        bulb = add_object(f"BarLight{i}", mesh, mat_plain(f"BarGlow{i}", (*colour, 1), emission=40.0))
        bulb.location = (back_x - 0.2, sign_y - 1.2 + y, z)
    add_light("WallWash", "AREA", (back_x - 1.2, 0, 2.2), 60, color=(1.0, 0.6, 0.3), size=4.0, rotation=(0, math.radians(-50), 0))


# ---- scene and render ---------------------------------------------------------

def reset(samples, width, height):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    try:
        # OptiX has failed silently on this machine's driver; CUDA is reliable.
        prefs.compute_device_type = "CUDA"
        prefs.get_devices()
        for device in prefs.devices:
            device.use = device.type == "CUDA"
        scene.cycles.device = "GPU" if any(d.use for d in prefs.devices) else "CPU"
    except Exception as error:  # no GPU: render on the CPU
        print("GPU setup failed, using CPU:", error)
        scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    world = bpy.data.worlds.new("World")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.012, 0.014, 0.02, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 1.0
    scene.world = world
    return scene


def render(scene, path, fmt="WEBP", quality=90):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    scene.render.image_settings.file_format = fmt
    if fmt in ("WEBP", "JPEG"):
        scene.render.image_settings.quality = quality
    scene.render.image_settings.color_mode = "RGB"
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("WROTE", path)


def table_shot(draft):
    scene = reset(48 if draft else 320, VIEW_W * 2, VIEW_H * 2)
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    build_table()
    lights()
    cam_data = bpy.data.cameras.new("TopCam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = VIEW_W * S
    cam = bpy.data.objects.new("TopCam", cam_data)
    cam.location = (0, 0, 1.0)
    scene.collection.objects.link(cam)
    scene.camera = cam
    # The lamp sits above the camera and is not in view.
    render(scene, os.path.join(ROOT, "src", "art", "table.webp"), quality=88)


def hero_shot(name, width, height, draft):
    scene = reset(64 if draft else 420, width, height)
    scene.view_settings.view_transform = "Standard"
    for look in ("Medium High Contrast", "Medium Contrast"):
        try:
            scene.view_settings.look = look
            break
        except TypeError:
            continue
    build_table()
    lights(0.85, fill=0.45)
    aspect = width / height
    if aspect > 1.2:
        build_room(sign_y=1.25, sign_z=0.29, ring_r=0.08)
    else:
        build_room(sign_y=0.75)
    cam_at = P(60, 470, 0.36) if aspect > 1.2 else P(110, 520, 0.5)
    rng = random.Random(6)
    for number, x, y in scatter_balls(rng):
        add_ball(number, x, y, rng, look_at=cam_at)
    cue_x, cue_y = FOOT_X - 96, MID_Y + 6
    add_ball(0, cue_x, cue_y, rng)
    add_cue(cue_x - BALL_R - 30, cue_y - 2, 2.0, lift_deg=4.0)

    # A lamp shade over the table, seen at the top of the frame.
    shade = mat_plain("LampShade", (0.02, 0.09, 0.05, 1), roughness=0.35, coat=0.5)
    brass = mat_plain("LampBrass", (0.75, 0.50, 0.14, 1), roughness=0.3, metallic=1.0)
    prism("LampShadeBox", [(140, 170), (820, 170), (820, 370), (140, 370)], 1.16, 1.30, shade, bevel=0.03)
    prism("LampRail", [(120, 262), (840, 262), (840, 278), (120, 278)], 1.30, 1.33, brass, bevel=0.006)

    cam_data = bpy.data.cameras.new("HeroCam")
    # Very wide formats use a shorter lens so the frame keeps its height.
    cam_data.lens = 24 if aspect > 2.5 else 40 if aspect > 1.5 else 32
    cam_data.dof.use_dof = True
    cam_data.dof.aperture_fstop = 2.4
    cam = bpy.data.objects.new("HeroCam", cam_data)
    # Low, behind and beside the cue ball, looking down the table.
    cam.location = cam_at
    scene.collection.objects.link(cam)
    target = bpy.data.objects.new("HeroTarget", None)
    target.location = P(FOOT_X - 10, MID_Y - 6, 0.02)
    scene.collection.objects.link(target)
    track = cam.constraints.new("TRACK_TO")
    track.target = target
    track.track_axis = "TRACK_NEGATIVE_Z"
    track.up_axis = "UP_Y"
    cam_data.dof.focus_object = target
    scene.camera = cam
    fmt = "PNG"
    render(scene, os.path.join(ROOT, "art", "renders", f"{name}.png"), fmt=fmt)
    if name == "keyart":
        # The title screen uses the 16:9 key art as its backdrop.
        scene.render.image_settings.file_format = "WEBP"
        scene.render.image_settings.quality = 86
        bpy.data.images["Render Result"].save_render(os.path.join(ROOT, "src", "art", "keyart.webp"), scene=scene)
        print("WROTE keyart.webp")


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    draft = "draft" in argv
    argv = [a for a in argv if a != "draft"]
    mode = argv[0] if argv else "table"
    if mode == "table":
        table_shot(draft)
    elif mode == "hero":
        name = argv[1] if len(argv) > 1 else "keyart"
        width = int(argv[2]) if len(argv) > 2 else 1920
        height = int(argv[3]) if len(argv) > 3 else 1080
        hero_shot(name, width, height, draft)
    elif mode == "save":
        reset(64, VIEW_W * 2, VIEW_H * 2)
        build_table()
        lights()
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, "art", "blender", "rokumon_pool_table.blend"))
    else:
        raise SystemExit(f"Unknown mode: {mode}")


main()
