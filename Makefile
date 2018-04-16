OWNER=streamr
IMAGE_NAME=ethereum-watcher
VCS_REF=`git rev-parse --short HEAD`
IMAGE_VERSION=0.2.$(TRAVIS_BUILD_NUMBER)
QNAME=$(OWNER)/$(IMAGE_NAME)

GIT_TAG=$(QNAME):$(VCS_REF)
BUILD_TAG=$(QNAME):$(IMAGE_VERSION)
LATEST_TAG=$(QNAME):latest
npm-login:
	npm install -g npm-cli-login
	npm-cli-login
docker-build:
	docker build \
		--build-arg VCS_REF=$(VCS_REF) \
		--build-arg IMAGE_VERSION=$(IMAGE_VERSION) \
		-t $(GIT_TAG) .

docker-lint:
	docker run -it --rm -v "$(PWD)/Dockerfile:/Dockerfile:ro" redcoolbeans/dockerlint

docker-tag:
	docker tag $(GIT_TAG) $(BUILD_TAG)
	docker tag $(GIT_TAG) $(LATEST_TAG)

docker-login:
	@docker login -u "$(DOCKER_USER)" -p "$(DOCKER_PASS)"

docker-push: docker-login
	docker push $(LATEST_TAG)
.PHONY: unit-test
unit-test:
	npm install
	npm test

