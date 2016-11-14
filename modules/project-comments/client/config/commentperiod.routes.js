'use strict';
// =========================================================================
//
// comment period routes
//
// =========================================================================
angular.module('comment').config(['$stateProvider', function ($stateProvider) {
	$stateProvider
	// -------------------------------------------------------------------------
	//
	// this is the abstract, top level view for comment periods.
	// since it is a child of p (project), the project injection has already
	// been resolved and is available to subsequent child states as 'project'
	// here we will resolve the list of periods for this project, which will
	// also become available to child states as 'periods'
	//
	// -------------------------------------------------------------------------
	.state('p.commentperiod', {
		abstract:true,
		url: '/commentperiod',
		template: '<ui-view class="comment-period-view"></ui-view>',
		resolve: {
			periods: function ($stateParams, CommentPeriodModel, project) {
				return CommentPeriodModel.forProject (project._id);
			},
			artifacts: function (project, ArtifactModel) {
				return ArtifactModel.forProject (project._id);
			}
		}
	})
	// -------------------------------------------------------------------------
	//
	// the list state for comment periods, project and periods are guaranteed to
	// already be resolved
	//
	// -------------------------------------------------------------------------
	.state('p.commentperiod.list', {
		url: '/list',
		templateUrl: 'modules/project-comments/client/views/period-list.html',
		resolve: {
			periods: function ($stateParams, CommentPeriodModel, project) {
				return CommentPeriodModel.forProjectWithStats (project._id);
			}
		},
		controller: function ($scope, NgTableParams, periods, project, _) {
			var s = this;
			console.log ('periods = ', periods);
			$scope.tableParams = new NgTableParams ({count:10}, {dataset: periods});
			$scope.project = project;

			// filter lists...
			s.typeArray = [];
			s.phaseArray = [];
			s.artifactArray = [];
			s.versionArray = [];

			// build out the filter arrays...
			var recs = _(angular.copy(periods)).chain().flatten();
			recs.pluck('periodType').unique().value().map(function (item) {
				s.typeArray.push({id: item, title: item});
			});
			recs.pluck('phaseName').unique().value().map(function (item) {
				s.phaseArray.push({id: item, title: item});
			});
			recs.pluck('artifactName').unique().value().map(function (item) {
				s.artifactArray.push({id: item, title: item});
			});
			recs.pluck('artifactVersion').unique().value().map(function (item) {
				s.versionArray.push({id: item, title: item});
			});

		},
		controllerAs: 's'
	})
	// -------------------------------------------------------------------------
	//
	// this is the add, or create state. it is defined before the others so that
	// it does not conflict
	//
	// -------------------------------------------------------------------------
	.state('p.commentperiod.create', {
		url: '/create',
		templateUrl: 'modules/project-comments/client/views/period-edit.html',
		resolve: {
			period: function (CommentPeriodModel) {
				return CommentPeriodModel.getNew ();
			}
		},
		onEnter: function($state, project){
			// can't use data.permissions, as project is not loaded
			// so check this now before we get into the controller...
			if (!project.userCan.createCommentPeriod) {
				$state.go('forbidden');
			}
		},
		controller: function ($scope, $state, project, period, CommentPeriodModel, artifacts, _) {
			$scope.period = period;
			$scope.project = project;
			// only allowing public comments to be created for now, so limit these to published artifacts only.
			$scope.artifacts = _.filter(artifacts, function(o) { return o.isPublished; });
			$scope.changeType = function () {
				if (period.periodType === 'Public') {
					period.commenterRoles = ['public'];
				} else {
					period.commenterRoles = [];
				}
			};
			$scope.hasErrors = false;
			//$scope.errorMessage = '';

			$scope.save = function () {
				if (_.size($scope.period.commenterRoles) === 0 || _.size($scope.period.vettingRoles) === 0 || _.size($scope.period.classificationRoles) === 0) {
					$scope.hasErrors = true;
					//$scope.errorMessage = 'Post, Vet and Classify Comments roles are all required. See Roles & Permissions tab.';
				} else {
					period.project = project._id;
					
					period.phase = project.currentPhase;
					period.phaseName = project.currentPhase.name;
					
					period.artifactName = period.artifact.name;
					period.artifactVersion = period.artifact.version;
					period.artifactVersionNumber = period.artifact.versionNumber;
					period.artifactTypeCode = period.artifact.typeCode;
					CommentPeriodModel.add($scope.period)
					.then(function (model) {
						$state.transitionTo('p.commentperiod.list', {projectid: project.code}, {
							reload: true, inherit: false, notify: true
						});
					})
					.catch(function (err) {
						console.error(err);
						// alert (err.message);
					});
				}
			};
			$scope.changeType ();
		}
	})
	// -------------------------------------------------------------------------
	//
	// this is the edit state
	//
	// -------------------------------------------------------------------------
	.state('p.commentperiod.edit', {
		url: '/:periodId/edit',
		templateUrl: 'modules/project-comments/client/views/period-edit.html',
		resolve: {
			period: function ($stateParams, CommentPeriodModel) {
				// console.log ('editing periodId = ', $stateParams.periodId);
				return CommentPeriodModel.getModel ($stateParams.periodId);
			}
		},
		onEnter: function($state, project){
			// can't use data.permissions, as project is not loaded
			// so check this now before we get into the controller...
			if (!project.userCan.createCommentPeriod) {
				$state.go('forbidden');
			}
		},
		controller: function ($scope, $state, period, project, CommentPeriodModel, CommentModel, _) {
			// only public comments for now...
			period.periodType = 'Public';
			period.commenterRoles = ['public'];

			$scope.period = period;
			$scope.project = project;

			$scope.artifacts = [period.artifact];

			$scope.changeType = function () {
				if (period.periodType === 'Public') {
					period.commenterRoles = ['public'];
				} else {
					period.commenterRoles = [];
				}
			};
			
			$scope.hasErrors = false;
			$scope.errorMessage = '';

			$scope.save = function () {
				if (_.size($scope.period.commenterRoles) === 0 || _.size($scope.period.vettingRoles) === 0 || _.size($scope.period.classificationRoles) === 0) {
					$scope.hasErrors = true;
					$scope.errorMessage = 'Post, Vet and Classify Comments roles are all required.  See Roles & Permissions tab.';
				} else {
					CommentPeriodModel.save($scope.period)
					.then(function (model) {
						// console.log ('period was saved',model);
						// save the comments so that we pick up the (potential) changes to the period permissions...
						return CommentModel.getAllCommentsForPeriod(model._id);
					})
					.then(function (comments) {
						Promise.resolve()
						.then(function () {
							return comments.reduce(function (current, value, index) {
								return CommentModel.save(value);
							}, Promise.resolve());
						});
					}).then(function () {
						$state.transitionTo('p.commentperiod.list', {projectid: project.code}, {
							reload: true, inherit: false, notify: true
						});
					})
					.catch(function (err) {
						console.error(err);
						// alert (err.message);
					});
				}
			};
			$scope.changeType ();
		}
	})
	// -------------------------------------------------------------------------
	//
	// this is the 'view' mode of a comment period. here we are just simply
	// looking at the information for this specific object
	//
	// ** this is where we should go to the view of the comments
	//
	// -------------------------------------------------------------------------
	.state('p.commentperiod.detail', {
		url: '/:periodId',
		templateUrl: 'modules/project-comments/client/views/period-view.html',
		resolve: {
			period: function ($stateParams, CommentPeriodModel) {
				return CommentPeriodModel.getModel ($stateParams.periodId);
			},
			artifact: function (period, ArtifactModel) {
				return ArtifactModel.getModel (period.artifact._id);
			}
		},
		controller: function ($scope, period, project, artifact) {
			//console.log ('period user can: ', JSON.stringify(period.userCan, null, 4));
			var today       = new Date ();
			var start       = new Date (period.dateStarted);
			var end         = new Date (period.dateCompleted);
			var isopen      = start < today && today < end;
			$scope.isOpen   = isopen;
			$scope.isBefore = (start > today);
			$scope.isClosed = (end < today);
			$scope.period   = period;
			$scope.project  = project;
			$scope.artifact = artifact;
			// anyone with vetting comments can add a comment at any time
			// all others with add comment permission must wait until the period is open
			$scope.allowCommentSubmit = (isopen && period.userCan.addComment) || period.userCan.vetComments;
		}
	})

	;

}]);











