sap.ui.define(["sap/m/ComboBox"],
    function (FeedComboBox) {
        "use strict";
        return FeedComboBox.extend("com.timereporting.control.FeedComboBox", {
            renderer: {},
            init: function () {
                sap.m.ComboBox.prototype.init.apply(this, arguments);
                this.setFilterFunction(function (sTerm, oItem) {
                    // A case-insensitive 'string contains' filter
                    return oItem.getText().match(new RegExp(sTerm, "i")) || oItem.getKey().match(new RegExp(sTerm, "i"));
                });
            }
        });
    });