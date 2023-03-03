import { LIVE2DCUBISMFRAMEWORK } from "./live2dcubismframework.js";
import { LIVE2DCUBISMPIXI } from "./live2dcubismpixi.js";
import { Live2DCubismCore } from "./live2dcubismcore.js";

class L2D {
  constructor(basePath) {
    this.basePath = basePath;
    this.loader = new PIXI.loaders.Loader(this.basePath);
    this.animatorBuilder = new LIVE2DCUBISMFRAMEWORK.AnimatorBuilder();
    this.timeScale = 1;
    this.models = {};
  }

  setPhysics3Json(value) {
    if (!this.physicsRigBuilder) {
      this.physicsRigBuilder = new LIVE2DCUBISMFRAMEWORK.PhysicsRigBuilder();
    }
    this.physicsRigBuilder.setPhysics3Json(value);

    return this;
  }

  load(name, v) {
    if (!this.models[name]) {
      let modelDir = name + "/";
      name = name.split("/").pop();
      let modelPath = name + ".model3.json";
      let textures = new Array();
      let textureCount = 0;
      let motionNames = new Array();

      this.loader.add(name + "_model", modelDir + modelPath, { xhrType: PIXI.loaders.Resource.XHR_RESPONSE_TYPE.JSON });

      this.loader.load((loader, resources) => {
        let model3Obj = resources[name + "_model"].data;

        if (typeof model3Obj["FileReferences"]["Moc"] !== "undefined") {
          loader.add(name + "_moc", modelDir + model3Obj["FileReferences"]["Moc"], { xhrType: PIXI.loaders.Resource.XHR_RESPONSE_TYPE.BUFFER });
        }

        if (typeof model3Obj["FileReferences"]["Textures"] !== "undefined") {
          model3Obj["FileReferences"]["Textures"].forEach((element) => {
            loader.add(name + "_texture" + textureCount, modelDir + element);
            textureCount++;
          });
        }

        if (typeof model3Obj["FileReferences"]["Physics"] !== "undefined") {
          loader.add(name + "_physics", modelDir + model3Obj["FileReferences"]["Physics"], { xhrType: PIXI.loaders.Resource.XHR_RESPONSE_TYPE.JSON });
        }

        if (typeof model3Obj["FileReferences"]["Motions"] !== "undefined") {
          for (let group in model3Obj["FileReferences"]["Motions"]) {
            model3Obj["FileReferences"]["Motions"][group].forEach((element) => {
              let motionName = element["File"].split("/").pop().split(".").shift();
              loader.add(name + "_" + motionName, modelDir + element["File"], { xhrType: PIXI.loaders.Resource.XHR_RESPONSE_TYPE.JSON });
              motionNames.push(name + "_" + motionName);
            });
          }
        }

        let groups = null;
        if (typeof (model3Obj["Groups"] !== "undefined")) {
          groups = LIVE2DCUBISMFRAMEWORK.Groups.fromModel3Json(model3Obj);
        }

        loader.load((l, r) => {
          let moc = null;

          if (typeof r[name + "_moc"] !== "undefined") {
            moc = Live2DCubismCore.Moc.fromArrayBuffer(r[name + "_moc"].data);
          }

          if (typeof r[name + "_texture" + 0] !== "undefined") {
            for (let i = 0; i < textureCount; i++) {
              textures.splice(i, 0, r[name + "_texture" + i].texture);
            }
          }

          if (typeof r[name + "_physics"] !== "undefined") {
            this.setPhysics3Json(r[name + "_physics"].data);
          }

          let motions = new Map();
          motionNames.forEach((element) => {
            let n = element.split(name + "_").pop();
            motions.set(n, LIVE2DCUBISMFRAMEWORK.Animation.fromMotion3Json(r[element].data));
          });

          let model = null;
          let coreModel = Live2DCubismCore.Model.fromMoc(moc);
          if (coreModel == null) {
            return;
          }

          let animator = this.animatorBuilder.setTarget(coreModel).setTimeScale(this.timeScale).build();

          let physicsRig = this.physicsRigBuilder.setTarget(coreModel).setTimeScale(this.timeScale).build();

          let userData = null;

          model = LIVE2DCUBISMPIXI.Model._create(coreModel, textures, animator, physicsRig, userData, groups);
          model.motions = motions;
          this.models[name] = model;
          v.changeCanvas(model);
        });
      });
    } else {
      v.changeCanvas(this.models[name]);
    }
  }
}

const sleep = (milliseconds) => {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

const getBox = async (className) => {
  let dom = $("." + className);
  while (!dom.length) {
    await sleep(500);
    dom = $("." + className);
  }
  return dom;
};

class Viewer {
  constructor(basePath, name) {
    this.l2d = new L2D(basePath);
    this.model = null;
    this.interval = null;
    const box = document.createElement("div");
    box.style.position = "fixed";
    box.style.bottom = "-102px";
    box.style.right = "0px";
    box.style.zIndex = "2";
    box.style.pointerEvents = "none";
    box.style.zoom = 0.6

    this.canvas = $(box);

    name = name || "xuefeng";
    this.l2d.load(name, this);

    this.app = new PIXI.Application(1280, 1280, { transparent: true });
    let width = 720;
    let height = (width / 1) * 1;
    this.width = width;
    this.height = height;
    this.app.view.style.width = width + "px";
    this.app.view.style.height = height + "px";
    this.app.renderer.resize(width, height);

    this.canvas.html(this.app.view);

    this.app.ticker.add((deltaTime) => {
      if (!this.model) {
        return;
      }

      this.model.update(deltaTime);
      this.model.masks.update(this.app.renderer);
    });

    this.isClick = false;
    this.app.view.addEventListener("mousedown", (event) => {
      this.isClick = true;
    });
    this.app.view.addEventListener("mousemove", (event) => {
      if (this.isClick) {
        this.isClick = false;
        if (this.model) {
          this.model.inDrag = true;
        }
      }

      if (this.model) {
        let mouse_x = this.model.position.x - event.offsetX;
        let mouse_y = this.model.position.y - event.offsetY;
        this.model.pointerX = -mouse_x / this.app.view.height;
        this.model.pointerY = -mouse_y / this.app.view.width;
      }
    });
    this.app.view.addEventListener("mouseup", (event) => {
      if (!this.model) {
        return;
      }

      if (this.isClick) {
        if (this.isHit("TouchHead", event.offsetX, event.offsetY)) {
          this.startAnimation("touch_head", "base");
        } else if (this.isHit("TouchSpecial", event.offsetX, event.offsetY)) {
          this.startAnimation("touch_special", "base");
        } else {
          const bodyMotions = ["touch_body", "main_1", "main_2", "main_3"];
          let currentMotion = bodyMotions[Math.floor(Math.random() * bodyMotions.length)];
          this.startAnimation(currentMotion, "base");
        }
      }

      this.isClick = false;
      this.model.inDrag = false;
    });
  }

  async changeCanvas(model) {
    this.app.stage.removeChildren();

    this.model = model;
    this.model.update = this.onUpdate; // HACK: use hacked update fn for drag support
    this.model.animator.addLayer("base", LIVE2DCUBISMFRAMEWORK.BuiltinAnimationBlenders.OVERRIDE, 1);

    this.app.stage.addChild(this.model);
    this.app.stage.addChild(this.model.masks);

    this.app.renderer.resize(this.width, this.height);

    this.model.position = new PIXI.Point(this.width * 0.5, this.height * 0.5);
    this.model.scale = new PIXI.Point(this.model.position.x * 0.06, this.model.position.x * 0.06);
    this.model.masks.resize(this.app.view.width, this.app.view.height);

    const target = await getBox("chromium");
    target.append(this.canvas);

    //定时播放动画
    clearInterval(this.interval);
    let n = 0;
    let motionsKey = []
    model.motions.forEach((v,k)=>{
      if(k!=='effect' && k!=='login'){
        motionsKey.push(k)
      }
    })
    this.startAnimation('login', "base");
    this.interval = setInterval(() => {
      this.startAnimation(motionsKey[n], "base");
      if (n > motionsKey.length - 1) {
        n = 0;
      } else {
        n++;
      }
    }, 30 * 1000);
  }

  onUpdate(delta) {
    let deltaTime = 0.016 * delta;

    if (!this.animator.isPlaying) {
      let m = this.motions.get("idle");
      this.animator.getLayer("base").play(m);
    }
    this._animator.updateAndEvaluate(deltaTime);

    if (this.inDrag) {
      this.addParameterValueById("ParamAngleX", this.pointerX * 30);
      this.addParameterValueById("ParamAngleY", -this.pointerY * 30);
      this.addParameterValueById("ParamBodyAngleX", this.pointerX * 10);
      this.addParameterValueById("ParamBodyAngleY", -this.pointerY * 10);
      this.addParameterValueById("ParamEyeBallX", this.pointerX);
      this.addParameterValueById("ParamEyeBallY", -this.pointerY);
    }

    if (this._physicsRig) {
      this._physicsRig.updateAndEvaluate(deltaTime);
    }

    this._coreModel.update();

    let sort = false;
    for (let m = 0; m < this._meshes.length; ++m) {
      this._meshes[m].alpha = this._coreModel.drawables.opacities[m];
      this._meshes[m].visible = Live2DCubismCore.Utils.hasIsVisibleBit(this._coreModel.drawables.dynamicFlags[m]);
      if (Live2DCubismCore.Utils.hasVertexPositionsDidChangeBit(this._coreModel.drawables.dynamicFlags[m])) {
        this._meshes[m].vertices = this._coreModel.drawables.vertexPositions[m];
        this._meshes[m].dirtyVertex = true;
      }
      if (Live2DCubismCore.Utils.hasRenderOrderDidChangeBit(this._coreModel.drawables.dynamicFlags[m])) {
        sort = true;
      }
    }

    if (sort) {
      this.children.sort((a, b) => {
        let aIndex = this._meshes.indexOf(a);
        let bIndex = this._meshes.indexOf(b);
        let aRenderOrder = this._coreModel.drawables.renderOrders[aIndex];
        let bRenderOrder = this._coreModel.drawables.renderOrders[bIndex];

        return aRenderOrder - bRenderOrder;
      });
    }

    this._coreModel.drawables.resetDynamicFlags();
  }

  startAnimation(motionId, layerId) {
    if (!this.model) {
      return;
    }

    let m = this.model.motions.get(motionId);
    if (!m) {
      return;
    }

    let l = this.model.animator.getLayer(layerId);
    if (!l) {
      return;
    }

    l.play(m);
  }

  isHit(id, posX, posY) {
    if (!this.model) {
      return false;
    }

    let m = this.model.getModelMeshById(id);
    if (!m) {
      return false;
    }

    const vertexOffset = 0;
    const vertexStep = 2;
    const vertices = m.vertices;

    let left = vertices[0];
    let right = vertices[0];
    let top = vertices[1];
    let bottom = vertices[1];

    for (let i = 1; i < 4; ++i) {
      let x = vertices[vertexOffset + i * vertexStep];
      let y = vertices[vertexOffset + i * vertexStep + 1];

      if (x < left) {
        left = x;
      }
      if (x > right) {
        right = x;
      }
      if (y < top) {
        top = y;
      }
      if (y > bottom) {
        bottom = y;
      }
    }

    let mouse_x = m.worldTransform.tx - posX;
    let mouse_y = m.worldTransform.ty - posY;
    let tx = -mouse_x / m.worldTransform.a;
    let ty = -mouse_y / m.worldTransform.d;

    return left <= tx && tx <= right && top <= ty && ty <= bottom;
  }
}

var v = new Viewer("/live2d_3/model/Azue Lane(JP)", "yichui_2");
