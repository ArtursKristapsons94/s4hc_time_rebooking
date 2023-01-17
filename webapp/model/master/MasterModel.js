sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (
    JSONModel,
    Filter,
    FilterOperator
) {
    "use strict";

    return JSONModel.extend("com.timereporting.model.master.MasterModel", {
        /**
         * @override
         * @param {any} [oData] 
         * @param {any} [bObserve]
         * @returns {sap.ui.model.json.JSONModel}
         */
        constructor: function () {
            this.setMasterModel(this);
            return JSONModel.prototype.constructor.apply(this, [{
                Filters: {
                    WorkPackage: "",
                    Status: "",
                    Role: "",
                    BillingType: "",
                    Employee: "",
                    DateFrom: new Date(),
                    DateTo: new Date()
                }
            }]);
        },

        /**
         * @param {sap.ui.model.odata.v2.ODataModel} oTimesheetRecordsModel 
         * @param {sap.ui.model.odata.v2.ODataModel} oBusinessPartnerModel 
         * @param {sap.ui.model.odata.v2.ODataModel} oTimeSheetModel
         * @param {sap.ui.model.json.JSONModel} oWorkpackageJSONModel
         * @param {sap.ui.model.json.JSONModel} oTimesheetData
         */
        setODataModels: function (oTimesheetRecordsModel, oBusinessPartnerModel, oTimeSheetModel, oWorkpackageJSONModel, oTimesheetData) {
            this._oTimesheetRecordsModel = oTimesheetRecordsModel;
            this._oBusinessPartnerModel = oBusinessPartnerModel;
            this._oTimeSheetModel = oTimeSheetModel;
            this._oWorkpackageJSONModel = oWorkpackageJSONModel;
            this._oTimesheetData = oTimesheetData;
        },

        setMasterModel: function (oMasterModel) {
            this._oMasterModel = oMasterModel;
        },

        applyFilters: function () {
            var mFilters = this._oMasterModel.getProperty("/Filters");
            var aFilters = [];
            if (mFilters.BillingType) {
                aFilters.push(new Filter("TimeSheetDataFields/BillingControlCategory", FilterOperator.EQ, mFilters.BillingType));
            }
            if (mFilters.Role) {
                aFilters.push(new Filter("TimeSheetDataFields/ActivityType", FilterOperator.EQ, mFilters.Role));
            }
            if (mFilters.Status) {
                aFilters.push(new Filter("TimeSheetStatus", FilterOperator.EQ, mFilters.Status));
            }
            if (mFilters.WorkPackage) {
                aFilters.push(new Filter("TimeSheetDataFields/WBSElement", FilterOperator.EQ, mFilters.WorkPackage));
            }

            aFilters.push(new Filter("TimeSheetRecord", FilterOperator.NE, ''));

            var oFilter = new Filter({
                filters: aFilters,
                and: true
            });

            return oFilter;
        },

        clearFilters: function () {
            const mFilters = this._oMasterModel.getProperty("/Filters");
            this._oMasterModel.setProperty("/Filters/DateFrom");
            this._oMasterModel.setProperty("/Filters/Status");
            this._oMasterModel.setProperty("/Filters/WorkPackage");
            this._oMasterModel.setProperty("/Filters/Role");
            this._oMasterModel.setProperty("/Filters/BillingType");
            this._oMasterModel.setProperty("/Filters/Employee");
            this._oMasterModel.setProperty("/Filters/DateTo");
        },

        datesFilterFunction: function () {
            var aFilters = [];
            const mFilters = this._oMasterModel.getProperty("/Filters");

            // Check if both DateFrom and DateTo filters are present
            if (mFilters.DateFrom && mFilters.DateFrom) {
                const dDateFromUTC = this._dateToUTC(mFilters.DateFrom);
                const dDateToUTC = this._dateToUTC(mFilters.DateTo);
                aFilters.push(new Filter("TimeSheetDate", FilterOperator.BT, dDateFromUTC, dDateToUTC));
            }
            // Check if only DateFrom filter is present
            else if (mFilters.DateFrom) {
                var dNextDate = mFilters.DateFrom;
                const dDateFromUTC = this._dateToUTC(fromDateValue);
                dNextDate = new Date(dNextDate);
                dNextDate = dNextDate.setDate(dNextDate.getDate() + 1);
                aFilters.push(new Filter("TimeSheetDate", FilterOperator.BT, this._dateToUTC(fromDateValue), dNextDate));
            }
            // Check if only DateTo filter is present
            else if (mFilters.DateTo) {
                var dFiltredDateToValue = new Date(mFilters.DateTo);
                dFiltredDateToValue.setDate(dFiltredDateToValue.getDate() + 1)
                aFilters.push(new Filter("TimeSheetDate", FilterOperator.BT, this._dateToUTC(this.firstDayInPreviousMonth(new Date())), this._dateToUTC(dFiltredDateToValue)));
            }
            // If no filters are present, use default values
            else {
                aFilters.push(new Filter("TimeSheetDate", FilterOperator.BT, this._dateToUTC(this.firstDayInPreviousMonth(new Date())), this._dateToUTC(this.fifthDayOfCurrentMonth(new Date()))));
            }

            return aFilters;
        },

        firstDayInPreviousMonth: function (yourDate) {
            return new Date(yourDate.getFullYear(), yourDate.getMonth() - 1, 1);
        },

        fifthDayOfCurrentMonth: function (yourDate) {
            return new Date(yourDate.getFullYear(), yourDate.getMonth(), 6);
        },

        _dateToUTC(dDate) {
            return new Date(Date.UTC(dDate.getFullYear(), dDate.getMonth(), dDate.getDate()));
        },

        prepeareComboBoxForWorkpackage: function (sObjectId) {
            return new Promise((resolve, reject) => {
                var sPath = "/ProjectSet" + "('" + sObjectId + "')" + "/WorkpackageSet"
                this._oTimesheetRecordsModel.read(sPath, {
                    urlParameters: {
                        "$select": "WorkPackageName,WorkPackageID"
                    },
                    success: mWorkPackages => {
                        var oODataJSONModel = this._oWorkpackageJSONModel;
                        oODataJSONModel.setData({ workpackageEntity: mWorkPackages.results });
                        resolve();
                    },
                    error: function (mError) {
                        reject(mError);
                    }
                });
            });
        },

        readBusinessPartnerToEnrichFilter: function (orFilters) {
            var oFilters = [];
            var mFilters = this._oMasterModel.getProperty("/Filters");
            if (mFilters.Employee) {
                var sValuesForFilter = mFilters.Employee.split(" ");
                oFilters.push(new Filter("FirstName", FilterOperator.EQ, sValuesForFilter[0]));
                if (sValuesForFilter[1] !== undefined) {
                    if (sValuesForFilter[2] !== undefined) {
                        oFilters.push(new Filter("LastName", FilterOperator.EQ, `${sValuesForFilter[1]} ${sValuesForFilter[2]}`));
                    } else {
                        oFilters.push(new Filter("LastName", FilterOperator.EQ, sValuesForFilter[1]));
                    }
                }
            }
            if (oFilters.length > 0) {
                return new Promise((resolve, reject) => {
                    this._oBusinessPartnerModel.read("/YY1_I_PWA_EXT_API", {
                        urlParameters: {
                            "$select": "PersonWorkAgreement,BusinessPartner,FirstName,LastName"
                        },
                        filters: [
                            new Filter({
                                filters: oFilters,
                                and: true
                            })
                        ],
                        success: oData2 => {
                            oData2.results.map(function (oProperty) {
                                return orFilters.push(new Filter("PersonWorkAgreement", FilterOperator.EQ, oProperty.PersonWorkAgreement));
                            });
                            resolve();
                        },
                        error: function (mError) {
                            reject(mError);
                        }
                    });
                });
            }
        },

        readTimesheetToCollectData: function (aFilters, orFilters, sProjectID) {
            if (orFilters.length > 0) {
                aFilters.push(new sap.ui.model.Filter(orFilters, false));
            }
            orFilters = [];
            this.collectAdditionalsFilters(orFilters);
            aFilters.push(new sap.ui.model.Filter(orFilters, false));
            return new Promise((resolve, reject) => {
                this._oTimeSheetModel.read("/TimeSheetEntryCollection", {
                    filters: [
                        new Filter({
                            filters: aFilters,
                            and: true,
                        })
                    ],
                    success: mTimeSheets => {
                        const oFiltredPayload = mTimeSheets.results.filter(function (sValue) {
                            return sValue.TimeSheetDataFields.WBSElement.startsWith(sProjectID);
                        });
                        this._oTimesheetData.setData(oFiltredPayload);
                        resolve();
                    },
                    error: function (mError) {
                        reject(mError);
                    }
                });
            });
        },

        collectAdditionalsFilters: function (orFilters) {
            orFilters.push(new Filter("TimeSheetStatus", FilterOperator.EQ, '10'));
            orFilters.push(new Filter("TimeSheetStatus", FilterOperator.EQ, '20'));
            orFilters.push(new Filter("TimeSheetStatus", FilterOperator.EQ, '30'));
            orFilters.push(new Filter("TimeSheetStatus", FilterOperator.EQ, '40'));
        },

        enrichDataWithEmployeeName: function () {
            return new Promise(function (resolve, reject) {
                this._oBusinessPartnerModel.read("/YY1_I_PWA_EXT_API", {
                    urlParameters: {
                        "$select": "PersonWorkAgreement,BusinessPartner,FirstName,LastName"
                    },
                    success: mEployees => {
                        this._oTimesheetData.getData().forEach(mRecord => {
                            const mEployeeRecord = mEployees.results.find(function (mEployee) {
                                return mEployee.PersonWorkAgreement === mRecord.PersonWorkAgreement;
                            });
                            if (mEployeeRecord) {
                                mRecord.EmployeeName = mEployeeRecord.FirstName + " " + mEployeeRecord.LastName;
                                mRecord.BusinessPartner = mEployeeRecord.BusinessPartner;
                            }
                        });
                        resolve();
                    },
                    error: function (mError) {
                        reject(mError);
                    }
                });
            }.bind(this));
        },

        enrichDataWithWorkPackage: function (sProjectID) {
            const aFilters = [];
            aFilters.push(new Filter("WorkPackageID", FilterOperator.StartsWith, sProjectID));
            return new Promise(function (resolve, reject) {
                this._oTimesheetRecordsModel.read("/WorkpackageSet", {
                    urlParameters: {
                        "$select": "WorkPackageName,WorkPackageID"
                    },
                    filters: [
                        new Filter({
                            filters: aFilters,
                            and: true
                        })
                    ],
                    success: mWorkPackages => {
                        this._oTimesheetData.getData().forEach(mRecord => {
                            const mWorkpackageRecord = mWorkPackages.results.find(function (mWorkpackage) {
                                return mWorkpackage.WorkPackageID === mRecord.TimeSheetDataFields.WBSElement;
                            });
                            if (mWorkpackageRecord) {
                                mRecord.WorkPackageName = mWorkpackageRecord.WorkPackageName;
                                mRecord.ProjectID = "";
                                mRecord.WorkPackage = mWorkpackageRecord.WorkPackageID;
                            }
                        });
                        resolve();
                    },
                    error: function (mError) {
                        reject(mError);
                    }
                });
            }.bind(this));
        },

        /**
         * @override
         */
        destroy: function () {
            this._oMasterModel = null;
            this._oBusinessPartnerModel = null;
            this._oTimeSheetModel = null;
            JSONModel.prototype.destroy.apply(this, arguments);
        },

    });
});