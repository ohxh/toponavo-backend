var mongoose = require("mongoose");
var uniqueValidator = require("mongoose-unique-validator");
var slug = require("slug");
var User = mongoose.model("User");

var MapSchema = new mongoose.Schema(
  {
    slug: { type: String, lowercase: true, unique: true },
    title: String,
    description: String,
    body: String,
    favoritesCount: { type: Number, default: 0 },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  {
    timestamps: true,
    usePushEach: true
  }
);

MapSchema.plugin(uniqueValidator, { message: "is already taken" });

MapSchema.pre("validate", function(next) {
  if (!this.slug) {
    this.slugify();
  }

  next();
});

MapSchema.methods.slugify = function() {
  this.slug =
    slug(this.title) +
    "-" +
    ((Math.random() * Math.pow(36, 6)) | 0).toString(36);
};

MapSchema.methods.updateFavoriteCount = function() {
  var map = this;

  return User.count({ favorites: { $in: [map._id] } }).then(function(count) {
    map.favoritesCount = count;

    return map.save();
  });
};

MapSchema.methods.toJSONFor = function(user) {
  return {
    slug: this.slug,
    title: this.title,
    description: this.description,
    body: this.body,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    favorited: user ? user.isFavorite(this._id) : false,
    favoritesCount: this.favoritesCount,
    author: this.author.toProfileJSONFor(user)
  };
};

mongoose.model("Map", MapSchema);
