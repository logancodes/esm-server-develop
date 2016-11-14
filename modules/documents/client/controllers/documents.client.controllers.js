'use strict';

angular.module('documents')
	.controller('controllerDocumentUploadGlobal', controllerDocumentUploadGlobal)
	.controller('controllerDocumentLinkGlobal', controllerDocumentLinkGlobal)
	.controller('controllerDocumentList', controllerDocumentList)
	.controller('controllerDocumentBrowser', controllerDocumentBrowser)
	.controller('controllerModalDocumentViewer', controllerModalDocumentViewer)
	.controller('controllerModalDocumentUploadClassify', controllerModalDocumentUploadClassify)
	.controller('controllerModalDocumentLink', controllerModalDocumentLink)
	.controller('controllerModalDocumentUploadReview', controllerModalDocumentUploadReview)
	.controller('controllerSignatureUpload', controllerSignatureUpload)
	.filter('removeExtension', filterRemoveExtension)
	.filter('displayFriendlyCode', filterDisplayFriendlyLocationCode);

// -----------------------------------------------------------------------------------
//
// CONTROLLER: Document Upload General
//
// -----------------------------------------------------------------------------------
controllerDocumentLinkGlobal.$inject = ['$scope', 'Upload', '$timeout', 'Document', '_'];
/* @ngInject */
function controllerDocumentLinkGlobal($scope, Upload, $timeout, Document, _) {
	var docLink = this;
	docLink.linkFiles = [];
	docLink.project = null;
	docLink.current = [];

	docLink.ids = [];
	
	docLink.docLocationCode = $scope.docLocationCode;
	docLink.artifact = $scope.artifact;

	docLink.sav = angular.copy($scope.current);

	docLink.changeItem = function (docObj) {
		if ($scope.current) {
			var idx = $scope.current.indexOf(docObj._id);
			// console.log(idx);
			if (idx === -1) {
				docLink.linkFiles.push(docObj);
				$scope.current.push(docObj._id);
			} else {
				_.remove(docLink.linkFiles, {_id: docObj._id});
				_.remove($scope.current, function(n) {return n === docObj._id;});
			}
		}
	};

	$scope.$on('linkCancel', function (event, obj) {
		// Need to rebuild the old array - since we're cancelling this whole operation
		_.each(docLink.sav, function (item) {
			$scope.current.push(item);
		});
	});

	$scope.$on('toggleDocumentLink', function(event, docObj) {
		docLink.changeItem(docObj);
	});

	$scope.$watch('current', function(newValue) {
		// Bring in existing values.
		if (newValue) {
			// get the objects from the array.
			Document.getDocumentsInList (newValue)
			.then( function(res) {
				docLink.linkFiles = res;
			});
		}
	});

	$scope.$watch('project', function(newValue) {
		if (newValue) {
			docLink.project = newValue;
			// console.log("project:",docLink.project);
			// TODO: Format in a nice list.
			Document.getProjectDocuments(docLink.project._id,false).then( function(res) {
				docLink.documents = res.data;
				// console.log("res:",res.data);
			});
		}
	});

	$scope.$on('documentLinkDone', function() {
		// This is an array of objectID's that the user decided to link
		// console.log("documentLinkDone",docLink.linkFiles);
		// Set the new array before we return back to the caller
		$scope.current = [];
		_.each(docLink.linkFiles, function(item) {
			// console.log('save', item);
			//$scope.current.push(item._id);
			$scope.current.push(item);
		});
	});
}
// -----------------------------------------------------------------------------------
//
// CONTROLLER: Document Upload General
//
// -----------------------------------------------------------------------------------
controllerDocumentUploadGlobal.$inject = ['$rootScope', '$scope', 'Upload', '$timeout', 'Document', '_', 'ENV', 'ArtifactModel'];
/* @ngInject */
function controllerDocumentUploadGlobal($rootScope, $scope, Upload, $timeout, Document, _, ENV, ArtifactModel) {
	var docUpload = this;
	var parentId = null;

	$scope.environment = ENV;

	docUpload.inProgress = false;
	docUpload.fileList = [];
	docUpload.type = null;
	docUpload.artifact = null;
	docUpload.artifacts = null;
	docUpload.documentList = [];
	docUpload.selectedArtifact = null;
	
	docUpload.allowArtifactSelect = true;
	docUpload.allowDocLocationSelect = true;

	$scope.$watch('hideUploadButton', function(newValue) {
		if (newValue) {
			docUpload.hideUploadButton = newValue;
		}
	});

	$scope.$watch('project', function(newValue) {
		if (newValue) {
			docUpload.project = newValue;
			docUpload.setTargetUrl();
			if (ENV === 'EAO') {
				// get listing of artifacts to attach to.  TODO: filter?
				ArtifactModel.forProject(newValue._id)
				.then( function(res) {
					// console.log("res",res);
					docUpload.artifacts = res;
					if (!_.isEmpty($scope.artifact)) {
						docUpload.selectedArtifact = _.find(docUpload.artifacts, function (o) {
							return o._id === $scope.artifact._id;
						});
						docUpload.allowArtifactSelect = _.isEmpty(docUpload.selectedArtifact);
					}
				});
			} else {
				Document.getProjectDocumentFolderNames(newValue._id).then( function(res) {
					// console.log("getProjectDocumentFolderNames",res.data);
					docUpload.docFolderNames = res.data;
				});
			}
			if (ENV === 'MEM') {
				Document.getProjectDocumentMEMTypes(newValue._id, false).then( function(res) {
					// console.log("getProjectDocumentMEMTypes",res.data);
					docUpload.docTypes = res.data;
					// First result is default
					docUpload.typeName = docUpload.docTypes[0];
				});
				Document.getProjectDocumentSubTypes(newValue._id, false).then( function(res) {
					// console.log("getProjectDocumentSubTypes",res.data);
					docUpload.docSubTypes = res.data;
				});
			}
		}
	});

	$scope.$watch('parentId', function(newValue) {
		if (newValue) {
			parentId = newValue;
			docUpload.setTargetUrl();
		}
	});

	docUpload.removeFile = function(f) {
		_.remove(docUpload.fileList, f);
		docUpload.checkEnableUpload();
	};

	// determine the correct target for the file upload based on x-type attribute.
	docUpload.targetUrl = null;

	$scope.$watch('type', function(newValue) {
		if (newValue) {
			docUpload.type = newValue;
			docUpload.setTargetUrl();
		}
	});


	docUpload.setTargetUrl = function() {
		// determine URL for upload, default to project if none set.
		if (docUpload.type === 'comment' && parentId) {
			docUpload.targetUrl = '/api/commentdocument/publiccomment/' + parentId + '/upload';
		}
		if (docUpload.type === 'project' && docUpload.project) {

			docUpload.targetUrl = '/api/document/' + docUpload.project._id + '/upload';
		}
	};

	// get types for dropdown.  EAO ONLY
	if (ENV === 'EAO') {
		docUpload.docTypes = Document.getDocumentTypes();
		docUpload.docSubTypes = Document.getDocumentSubTypes();

		// Artifact Location
		docUpload.docLocations = Document.getArtifactLocations();
		// try and set the default in the pick list....
		var foundDocLocation = _.find(docUpload.docLocations, function(o) { return o.code === $scope.docLocationCode; } );
		docUpload.selectedDocLocation =  foundDocLocation || docUpload.docLocations[0];
		docUpload.allowDocLocationSelect = _.isEmpty(foundDocLocation);
	}


	// allow the upload to be triggered from an external button.
	// this should be called and then documentUploadComplete should be listened for.
	$scope.$on('documentUploadStart', function(event, reviewUploader) {
		docUpload.upload(reviewUploader);
	});

	docUpload.checkEnableUpload = function () {
		if (docUpload.fileList.length > 0 && docUpload.selectedArtifact && docUpload.selectedArtifact._id && docUpload.selectedDocLocation.code) {
			$rootScope.$broadcast('enableUpload',  { enableUpload: true });
		} else {
			$rootScope.$broadcast('enableUpload',  { enableUpload: false });
		}
	};

	$scope.$watch('files', function (newValue) {
		if (newValue) {
			docUpload.inProgress = false;
			_.each( newValue, function(file, idx) {
				docUpload.fileList.push(file);
			});
		}
		docUpload.checkEnableUpload();
	});

	$scope.$watch('docUpload.selectedArtifact', function () {
		docUpload.checkEnableUpload();
	});
	$scope.$watch('docUpload.selectedDocLocation', function () {
		docUpload.checkEnableUpload();
	});

	docUpload.upload = function (uploadingReviewDocs) {
		var docCount = null;
		if (ENV === 'MEM') {
			// console.log("uploadingReviewDocs",uploadingReviewDocs);
			docUpload.inProgress = true;
			docCount = docUpload.fileList.length;
			// console.log('upload', docCount);
			if (docUpload.fileList && docUpload.fileList.length && docUpload.targetUrl) {
				angular.forEach( docUpload.fileList, function(file) {
					// Quick hack to pass objects
					// console.log("docUpload",docUpload);
					if (undefined === docUpload.typeName) docUpload.typeName = "Not Specified";
					if (undefined === docUpload.subTypeName) docUpload.subTypeName = "Not Specified";
					if (undefined === docUpload.folderName) docUpload.folderName = "Not Specified";

					file.upload = Upload.upload({
						url: docUpload.targetUrl,
						file: file,
						headers: { 'documenttype': docUpload.typeName,
								   'documentsubtype': docUpload.subTypeName,
								   'documentfoldername': docUpload.folderName,
								   'documentisinreview': uploadingReviewDocs}
					});

					file.upload.then(function (response) {
						$timeout(function () {
							file.result = response.data;
							// when the last file is finished, send complete event.
							if (--docCount === 0) {
								// emit to parent.
								$scope.$emit('documentUploadComplete');
							}
						});
					}, function (response) {
						if (response.status > 0) {
							docUpload.errorMsg = response.status + ': ' + response.data;
							// console.log("error data:",response.data);
						} else {
							_.remove($scope.files, file);
						}
					}, function (evt) {
						file.progress = Math.min(100, parseInt(100.0 * evt.loaded / evt.total));
					});
				});

			} else {
				// there are no documents so say it's all done
				$scope.$emit('documentUploadComplete');
			}
		} else {
			// EAO ENV.
			// console.log("uploadingReviewDocs",uploadingReviewDocs);
			docUpload.inProgress = true;
			docCount = docUpload.fileList.length;
			// console.log('upload', docCount);
			if (docUpload.fileList && docUpload.fileList.length && docUpload.targetUrl) {
				angular.forEach( docUpload.fileList, function(file) {

					// Inherit the permissions of the artifact if this is not internal
					var headers = {};
					if (docUpload.selectedDocLocation.code === 'internal') {
						headers = {
							'documenttype': 'ARTIFACT',
							'internalDocument': true
						};
					} else {
						headers = {
							'documenttype': 'ARTIFACT',
							'inheritModelPermissionId': docUpload.selectedArtifact._id
						};
					}
					// Quick hack to pass objects
					file.upload = Upload.upload({
						url: docUpload.targetUrl,
						file: file,
						headers: headers
					});

					file.upload.then(function (response) {
						$timeout(function () {
							file.result = response.data;
							// Generate a bunch of documentID's that need to be handled.
							docUpload.documentList.push(response.data._id);
							// console.log("docUpload.documentList",docUpload.documentList);
							// when the last file is finished, send complete event.
							if (--docCount === 0) {
								// emit to parent.
								// Go through all the documents that have been uploaded and push them
								// into a new artifact
								// console.log("selart:",docUpload.selectedArtifact._id);
								ArtifactModel.lookup(docUpload.selectedArtifact._id)
								.then( function (art) {
									// Little bit of synchronous magic!
									// console.log("artifact Found:",art);
									return docUpload.documentList.reduce (function (current, value, index) {
										return current.then (function (data) {
												// When we first enter, this is null.. since there was no previous
												// element.
												if (undefined === data) {
													data = art;
												}
												// Decide where to put this
												// console.log("docUpload.selectedDocLocation:", docUpload.selectedDocLocation);
												switch (docUpload.selectedDocLocation.code) {
													case "main":
														data.document = value;
													break;
													case "supporting":
														data.supportingDocuments.push(value);
													break;
													case "internal":
														data.internalDocuments.push(value);
													break;
													case "additional":
														data.additionalDocuments.push(value);
													break;
												}
												ArtifactModel.saveModel(data)
												.then( function() {
													$scope.$emit('documentUploadCompleteF');
													return Promise.resolve();
												});
										});
									}, Promise.resolve());
								});
							}
						});
					}, function (response) {
						if (response.status > 0) {
							docUpload.errorMsg = response.status + ': ' + response.data;
							// console.log("error data:",response.data);
						} else {
							_.remove($scope.files, file);
						}
					}, function (evt) {
						file.progress = Math.min(100, parseInt(100.0 * evt.loaded / evt.total));
					});
				});

			} else {
				// there are no documents so say it's all done
				$scope.$emit('documentUploadComplete');
			}
		}
	};
}
// -----------------------------------------------------------------------------------
//
// CONTROLLER: Document List
//
// -----------------------------------------------------------------------------------
// MBL: TODO inject Project, get documents related to this thing.
controllerDocumentList.$inject = ['$scope', 'Authentication'];
/* @ngInject */
function controllerDocumentList($scope, sAuthentication) {
	var docList = this;

	docList.authentication = sAuthentication;

	$scope.$watch('documents', function(newValue) {
		docList.documents = newValue;
	});

	$scope.$watch('documentsObjs', function(newValue) {
		docList.documentsObjs = newValue;
	});

	$scope.$watch('allowEdit', function(newValue) {
		docList.allowEdit = !!newValue;
	});

	$scope.$watch('project', function(newValue) {
		docList.project = newValue;
	});
}
// -----------------------------------------------------------------------------------
//
// CONTROLLER: Document List
//
// -----------------------------------------------------------------------------------
controllerDocumentBrowser.$inject = ['$scope', 'Document', '$rootScope', 'Authentication', 'ENV', '_', 'NgTableParams', 'ArtifactModel', 'PhaseModel'];
/* @ngInject */
function controllerDocumentBrowser($scope, Document, $rootScope, Authentication, ENV, _, NgTableParams, ArtifactModel, PhaseModel) {
	var docBrowser = this;

	$scope.environment = ENV;

	docBrowser.documentFiles	= undefined;
	docBrowser.docTypes			= undefined;
	// Review docs
	docBrowser.rdocumentFiles	= undefined;
	docBrowser.rdocTypes		= undefined;
	docBrowser.rDoc 			= undefined;

	docBrowser.authentication = Authentication;

	docBrowser.docLocationCode= $scope.docLocationCode;
	docBrowser.artifact = $scope.artifact;

	// -----------------------------------------------------------------------------------
	//
	// BROWSER: A complete refresh of everything.
	//
	// -----------------------------------------------------------------------------------
	docBrowser.refresh = function() {
		Document.getProjectDocuments(docBrowser.project._id, $scope.approvals)
		.then( function(res) {
			if (ENV === 'MEM') {
				// Apply slightly different sort criteria on the client side.
				// Do a substring date search on the internalOriginalName field.
				var docs = [];
				var re =/[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])/;
				angular.forEach( res, function(item) {
					var sortDate = re.exec(item.internalOriginalName);
					if (sortDate)
						item.sortDate = sortDate[0];
					docs.push(item);
				});
				docBrowser.documentFiles = _.sortByOrder(docs, "sortDate", "desc");
			} else {
				docBrowser.documentFiles = res;
			}
			$scope.$apply();
		});
		Document.getProjectDocumentTypes(docBrowser.project._id, $scope.approvals)
		.then( function(res) {
			var dts = [];
			if (ENV === 'MEM') {
				// console.log("list:",res.data)
				var sorted = _.sortBy(res, "order");
				dts	= sorted;
			} else {
				dts	= res;
			}
			angular.forEach(dts, function(item) {
				item.state = 'close';
				item.render = item.depth === 1;
			});
			docBrowser.docTypes = dts;
			$scope.$apply();
		});
	};

	var unbind = $rootScope.$on('refreshDocumentList', function() {
		docBrowser.refresh();
	});
	$scope.$on('$destroy', unbind);
	// -----------------------------------------------------------------------------------
	//
	// BROWSER: If in link mode, add the current document to the link list, or remove.
	//
	// -----------------------------------------------------------------------------------
	docBrowser.toggleDocumentLink = function(docObj) {
		$rootScope.$broadcast('toggleDocumentLink', docObj);
	};
	// -----------------------------------------------------------------------------------
	//
	// BROWSER: Wait for the allowLink
	//
	// -----------------------------------------------------------------------------------
	$scope.$watch('allowLink', function(newValue) {
		if (newValue) {
			docBrowser.allowLink = !!newValue;
		} else {
			docBrowser.allowLink = false;
		}
	});
	// -----------------------------------------------------------------------------------
	//
	// BROWSER: Wait for the Project, Load everythin related
	//
	// -----------------------------------------------------------------------------------
	$scope.$watch('project', function(newValue) {
		docBrowser.project = newValue;
		docBrowser.refresh();
	});
	// -----------------------------------------------------------------------------------
	//
	// BROWSER: Filtering
	//
	// -----------------------------------------------------------------------------------
	function onFolderSelect(selection) {

		// all items in the selection's Project Folder Type (root folder)...
		var selectedProjectFolderType = _.filter(docBrowser.docTypes, function (item) {
			return item.lineage.projectFolderType === selection.lineage.projectFolderType;
		});

		var otherProjectFolderTypes = _.filter(docBrowser.docTypes, function (item) {
			return item.lineage.projectFolderType !== selection.lineage.projectFolderType;
		});

		// only the items we care about...
		// selected level 1 will include all level 2, but no level 3
		// selected level 2 will have level 1 and itself and it's children, no sibling level 2 or their children
		var selectedTree = _.filter(docBrowser.docTypes, function (item) {
			if (selection.depth === 1) {
				return item.depth < 3 && item.lineage.projectFolderType === selection.lineage.projectFolderType;
			} else {
				return (item.depth === 1 && item.lineage.projectFolderType === selection.lineage.projectFolderType) ||
					(item.depth > 1 && item.lineage.projectFolderType === selection.lineage.projectFolderType && item.lineage.projectFolderSubType === selection.lineage.projectFolderSubType);
			}
		});

		if (selection.state === 'open') {
			// open to close
			_.forEach(selectedProjectFolderType, function(item) {
				item.render = item.depth <= selection.depth;
				item.state = 'close';
			});
			_.forEach(selectedTree, function(item) {
				item.render = item.depth <= selection.depth;
				item.state = (item.depth < selection.depth) ? 'open' : 'close';
			});
			selection.state = 'close';
			selection.render = true;
		} else {
			// close to open
			_.forEach(selectedProjectFolderType, function(item) {
				item.render = selection.depth < 3 ? item.depth <= selection.depth : item.depth < selection.depth;
				item.state = 'close';
			});
			_.forEach(selectedTree, function(item) {
				item.render = item.depth <= selection.depth + 1;
				item.state = (item.depth < selection.depth) ? 'open' : 'close';
			});
			selection.state = 'open';
			selection.render = true;
		}
		_.forEach(otherProjectFolderTypes, function(item) {
			item.state = 'close';
			item.render = item.depth === 1;
		});
	}

	docBrowser.filterList = function(selection) {
		$scope.filterSummary = undefined;
		$scope.filterDocs = {};
		$scope.filterLinage = {};
		$scope.filterDocs[selection.reference] = selection.label;
		$scope.filterLinage = selection.lineage;
		onFolderSelect(selection);
	};
	// Filter for review files
	docBrowser.rfilterList = function(selection) {
		$scope.rfilterSummary = undefined;
		$scope.rfilterDocs = {};
		$scope.rfilterDocs[selection.reference] = selection.label;
		$scope.rfilterLinage = {};
		$scope.rfilterLinage = selection.lineage;
	};

	docBrowser.filterDocsSelected = function(row) {
		if (!$scope.filterDocs) {
			return false;
		}
		if ( $scope.filterLinage === row.lineage ) {
			return true;
		}
		return false;
	};

	docBrowser.filterSummary = function(doc) {
		$scope.bytes = {};
		$scope.filterSummary = doc;
		$scope.filterSummary.MBytes = (doc.internalSize / Math.pow(1024, Math.floor(2))).toFixed(2);
		Document.getProjectDocumentVersions(doc._id).then( function(res) {
			docBrowser.docVersions	= res;
			$scope.$apply();
		});
	};
	docBrowser.rfilterSummary = function(doc) {
		$scope.rfilterSummary = doc;
		Document.getProjectDocumentVersions(doc._id).then( function(res) {
			docBrowser.docVersions	= res;
			// Fix for if a version was uploaded while we hovered overtop last
			if (docBrowser.docVersions[docBrowser.docVersions.length-1].documentVersion >= $scope.rfilterSummary.documentVersion) {
				// console.log("Your data is stale!  Refresh the page");
			}
			$scope.$apply();
		});
	};
	docBrowser.downloadAndApprove = function(doc) {
		// console.log("Downloading and approving:",doc);
		// TODO: Hook up the scraping code
		Document.downloadAndApprove(doc._id).then( function(res) {
			// Update the table in the UI - call refresh
			// console.log("downloaded and approved!");
		});
	};
	docBrowser.deleteDocument = function(documentID) {
		// console.log("deleting:",documentID);
		Document.lookup(documentID)
		.then( function (doc) {
			return Document.getProjectDocumentVersions(doc._id);
		})
		.then( function (docs) {
			// Are there any prior versions?  If so, make them the latest and then delete
			// otherwise delete
			if (docs.length > 0) {
				return Document.makeLatestVersion(docs[docs.length-1]._id);
			} else {
				return null;
			}
		})
		.then( function () {
			// Delete it from the system.
			return Document.deleteDocument(documentID);
		})
		.then( function(res) {
			$scope.filterSummary = undefined;
			$rootScope.$broadcast('refreshDocumentList');
		});
	};
}
// -----------------------------------------------------------------------------------
//
// CONTROLLER: Modal: View Documents Comment
//
// -----------------------------------------------------------------------------------
controllerModalDocumentLink.$inject = ['$rootScope', '$modalInstance', '$scope', 'rProject', 'rCurrent', 'rDocLocationCode', 'rArtifact', '_'];
/* @ngInject */
function controllerModalDocumentLink($rootScope, $modalInstance, $scope, rProject, rCurrent, rDocLocationCode, rArtifact, _) {
	var docLink = this;
	docLink.linkFiles = [];
	docLink.project = rProject;
	docLink.current = rCurrent;

	docLink.savedCurrent = angular.copy(rCurrent);
	docLink.docLocationCode = rDocLocationCode;
	docLink.artifact = rArtifact;

	docLink.unlinkFile = function(f) {
		// console.log(f);
		//_.remove(docLink.documentsObjs, {_id: f._id});
		//_.remove(docLink.documents, function(n) {return n === f._id; });
	};

	// Close this cascaded modal
	$scope.$on('cleanup', function () {
		$modalInstance.close();
	});

	docLink.ok = function (items) {
		// console.log(items);
		$modalInstance.close();
	};
	docLink.cancel = function () {
		rCurrent = docLink.savedCurrent;
		$rootScope.$broadcast('linkCancel');
		$modalInstance.dismiss('cancel');
	};
}
// -----------------------------------------------------------------------------------
//
// CONTROLLER: Modal: View Documents Comment
//
// -----------------------------------------------------------------------------------
controllerModalDocumentUploadClassify.$inject = ['$modalInstance', '$scope', 'rProject', 'rDocLocationCode', 'rArtifact', '$rootScope'];
/* @ngInject */
function controllerModalDocumentUploadClassify($modalInstance, $scope, rProject, rDocLocationCode, rArtifact, $rootScope) {
	var docUploadModal = this;
	docUploadModal.uploading = false;

	docUploadModal.enableUpload = false;

	// Document upload complete so close and continue.
	$scope.$on('documentUploadCompleteF', function() {
		$rootScope.$broadcast('cleanup');
		$modalInstance.close();
	});

	$scope.$on('enableUpload', function (event, args) {
		docUploadModal.enableUpload = args.enableUpload;
	});

	docUploadModal.project = rProject;
	docUploadModal.docLocationCode = rDocLocationCode;
	docUploadModal.artifact = rArtifact;

	docUploadModal.ok = function () {
		$scope.$broadcast('documentUploadStart', false);
		docUploadModal.uploading = true;
	};
	docUploadModal.cancel = function () {
		$modalInstance.dismiss('cancel');
	};
}
// -----------------------------------------------------------------------------------
//
// CONTROLLER: Modal: View Documents Comment
//
// -----------------------------------------------------------------------------------
controllerModalDocumentUploadReview.$inject = ['$modalInstance', '$scope', 'rProject'];
/* @ngInject */
function controllerModalDocumentUploadReview($modalInstance, $scope, rProject) {
	var docUploadModalReview = this;

	// Document upload complete so close and continue.
	$scope.$on('documentUploadComplete', function() {
		$modalInstance.close();
	});

	docUploadModalReview.project = rProject;

	docUploadModalReview.ok = function () {
		$scope.$broadcast('documentUploadStart', true);
	};
	docUploadModalReview.cancel = function () {
		$modalInstance.dismiss('cancel');
	};
}
// -----------------------------------------------------------------------------------
//
// CONTROLLER: Modal: View Documents Comment
//
// -----------------------------------------------------------------------------------
controllerModalDocumentViewer.$inject = ['$modalInstance'];
/* @ngInject */
function controllerModalDocumentViewer($modalInstance) {
	var md = this;
	md.ok = function () { $modalInstance.close(); };
	md.cancel = function () { $modalInstance.dismiss('cancel'); };
}
// -----------------------------------------------------------------------------------
//
// CONTROLLER: Modal: View Documents Comment
//
// -----------------------------------------------------------------------------------
// controllerModalDocumentBuckets.$inject = ['$modalInstance'];
// /* @ngInject */
// function controllerModalDocumentBuckets($modalInstance) {
// 	var docBuckets = this;
// 	docBuckets.ok = function () { $modalInstance.close(); };
// 	docBuckets.cancel = function () { $modalInstance.dismiss('cancel'); };
// }
// -----------------------------------------------------------------------------------
//
// CONTROLLER: Modal: Signature Upload for User
//
// -----------------------------------------------------------------------------------
controllerSignatureUpload.$inject = ['UserModel', '$rootScope', '$scope', 'Upload', '$timeout', 'Document', '_', 'ENV', '$modalInstance'];
/* @ngInject */
function controllerSignatureUpload(UserModel, $rootScope, $scope, Upload, $timeout, Document, _, ENV, $modalInstance) {
	var sigUp = this;

	$scope.environment = ENV;

	sigUp.inProgress = false;
	sigUp.fileList = [];

	$scope.$watch('hideUploadButton', function(newValue) {
		if (newValue) {
			sigUp.hideUploadButton = newValue;
		}
	});

	sigUp.removeFile = function(f) {
		_.remove(sigUp.fileList, f);
	};

	$scope.$on('documentUploadComplete', function () {
		$rootScope.$broadcast('refreshSig');
		$modalInstance.close();
	});

	$scope.$watch('files', function (newValue) {
		if (newValue) {
			sigUp.inProgress = false;
			sigUp.fileList = [];
			sigUp.fileList.push(newValue[0]);
		}
	});

	sigUp.upload = function (uploadingReviewDocs) {
		sigUp.inProgress = true;
		// console.log('upload', docCount);
		if (sigUp.fileList && sigUp.fileList.length) {
			angular.forEach( sigUp.fileList, function(file) {
				// Quick hack to pass objects
				file.upload = Upload.upload({
					url: '/api/users/sig/upload',
					file: file
				});

				file.upload.then(function (response) {
					$timeout(function () {
						file.result = response.data;
						UserModel.me()
						.then( function (me) {
							me.signature = file.result._id;
							return UserModel.save(me);
						})
						.then( function (m) {
							$scope.$emit('documentUploadComplete', file.result);
						});
					});
				}, function (response) {
					if (response.status > 0) {
						sigUp.errorMsg = response.status + ': ' + response.data;
						// console.log("error data:",response.data);
					} else {
						_.remove($scope.files, file);
					}
				}, function (evt) {
					file.progress = Math.min(100, parseInt(100.0 * evt.loaded / evt.total));
				});
			});

		} else {
			// there are no documents so say it's all done
			$scope.$emit('documentUploadComplete');
		}
	};
}

// -----------------------------------------------------------------------------------
//
// FILTER: Remove Extension
//
// -----------------------------------------------------------------------------------
filterRemoveExtension.$inject = [];
/* @ngInject */
function filterRemoveExtension() {
	return function(input) {
		if (input) {
			// If there is no extension, just return the original.
			var index = input.lastIndexOf(".");
			if (index !== -1 && (index >= input.length-5)) {
				var filename = input.substring(0, index);
				return filename;
			}
		}
		return input;
	};
}

filterDisplayFriendlyLocationCode.$inject = [];
/* @ngInject */
function filterDisplayFriendlyLocationCode() {
	return function(input) {
		var label = "";
		switch (input) {
			case 'main':
				label = "Main Document";
			break;
			case 'supporting':
				label = "Supporting Documents";
			break;
			case 'additional':
				label = "Additional Documents";
			break;
			case 'internal':
				label = "Internal Documents";
			break;
		}
		return label;
	};
}

