// No-op kapsule stub used to replace react-force-graph VR/AR sub-packages
// (3d-force-graph-vr, 3d-force-graph-ar) that depend on AFRAME/THREE globals.
// These components are never rendered in this app; the stub satisfies the
// import without loading the A-Frame ecosystem.
export default function () {
  const instance = function () {
    return instance;
  } as Record<string, unknown> & (() => unknown);
  return instance;
}
