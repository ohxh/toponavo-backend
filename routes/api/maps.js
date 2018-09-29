var router = require("express").Router();
var mongoose = require("mongoose");
var Map = mongoose.model("Map");
var User = mongoose.model("User");
var auth = require("../auth");

// Preload map objects on routes with ':map'

router.param("map", function(req, res, next, slug) {
  Map.findOne({ slug: slug })
    .populate("author")
    .then(function(map) {
      if (!map) {
        return res.sendStatus(404);
      }

      req.map = map;

      return next();
    })
    .catch(next);
});

router.get("/", auth.optional, function(req, res, next) {
  var query = {};
  var limit = 20;
  var offset = 0;

  if (typeof req.query.limit !== "undefined") {
    limit = req.query.limit;
  }

  if (typeof req.query.offset !== "undefined") {
    offset = req.query.offset;
  }

  Promise.all([
    req.query.author ? User.findOne({ username: req.query.author }) : null,
    req.query.favorited ? User.findOne({ username: req.query.favorited }) : null
  ])
    .then(function(results) {
      var author = results[0];
      var favoriter = results[1];

      if (author) {
        query.author = author._id;
      }

      if (favoriter) {
        query._id = { $in: favoriter.favorites };
      } else if (req.query.favorited) {
        query._id = { $in: [] };
      }

      return Promise.all([
        Map.find(query)
          .limit(Number(limit))
          .skip(Number(offset))
          .sort({ createdAt: "desc" })
          .populate("author")
          .exec(),
        Map.count(query).exec(),
        req.payload ? User.findById(req.payload.id) : null
      ]).then(function(results) {
        var maps = results[0];
        var mapsCount = results[1];
        var user = results[2];

        return res.json({
          maps: maps.map(function(map) {
            return map.toJSONFor(user);
          }),
          mapsCount: mapsCount
        });
      });
    })
    .catch(next);
});

router.get("/feed", auth.required, function(req, res, next) {
  var limit = 20;
  var offset = 0;

  if (typeof req.query.limit !== "undefined") {
    limit = req.query.limit;
  }

  if (typeof req.query.offset !== "undefined") {
    offset = req.query.offset;
  }

  User.findById(req.payload.id).then(function(user) {
    if (!user) {
      return res.sendStatus(401);
    }

    Promise.all([
      Map.find({ author: { $in: user.following } })
        .limit(Number(limit))
        .skip(Number(offset))
        .populate("author")
        .exec(),
      Map.count({ author: { $in: user.following } })
    ])
      .then(function(results) {
        var maps = results[0];
        var mapsCount = results[1];

        return res.json({
          maps: maps.map(function(map) {
            return map.toJSONFor(user);
          }),
          mapsCount: mapsCount
        });
      })
      .catch(next);
  });
});

router.post("/", auth.required, function(req, res, next) {
  User.findById(req.payload.id)
    .then(function(user) {
      if (!user) {
        return res.sendStatus(401);
      }

      var map = new Map(req.body.map);

      map.author = user;

      return map.save().then(function() {
        console.log(map.author);
        return res.json({ map: map.toJSONFor(user) });
      });
    })
    .catch(next);
});

// return a map
router.get("/:map", auth.optional, function(req, res, next) {
  Promise.all([
    req.payload ? User.findById(req.payload.id) : null,
    req.map.populate("author").execPopulate()
  ])
    .then(function(results) {
      var user = results[0];

      return res.json({ map: req.map.toJSONFor(user) });
    })
    .catch(next);
});

// update map
router.put("/:map", auth.required, function(req, res, next) {
  User.findById(req.payload.id).then(function(user) {
    if (req.map.author._id.toString() === req.payload.id.toString()) {
      if (typeof req.body.map.title !== "undefined") {
        req.map.title = req.body.map.title;
      }

      if (typeof req.body.map.description !== "undefined") {
        req.map.description = req.body.map.description;
      }

      if (typeof req.body.map.body !== "undefined") {
        req.map.body = req.body.map.body;
      }

      req.map
        .save()
        .then(function(map) {
          return res.json({ map: map.toJSONFor(user) });
        })
        .catch(next);
    } else {
      return res.sendStatus(403);
    }
  });
});

// delete map
router.delete("/:map", auth.required, function(req, res, next) {
  User.findById(req.payload.id)
    .then(function(user) {
      if (!user) {
        return res.sendStatus(401);
      }

      if (req.map.author._id.toString() === req.payload.id.toString()) {
        return req.map.remove().then(function() {
          return res.sendStatus(204);
        });
      } else {
        return res.sendStatus(403);
      }
    })
    .catch(next);
});

// Favorite an map
router.post("/:map/favorite", auth.required, function(req, res, next) {
  var mapId = req.map._id;

  User.findById(req.payload.id)
    .then(function(user) {
      if (!user) {
        return res.sendStatus(401);
      }

      return user.favorite(mapId).then(function() {
        return req.map.updateFavoriteCount().then(function(map) {
          return res.json({ map: map.toJSONFor(user) });
        });
      });
    })
    .catch(next);
});

// Unfavorite an map
router.delete("/:map/favorite", auth.required, function(req, res, next) {
  var mapId = req.map._id;

  User.findById(req.payload.id)
    .then(function(user) {
      if (!user) {
        return res.sendStatus(401);
      }

      return user.unfavorite(mapId).then(function() {
        return req.map.updateFavoriteCount().then(function(map) {
          return res.json({ map: map.toJSONFor(user) });
        });
      });
    })
    .catch(next);
});

module.exports = router;
