script_directory=`dirname "${BASH_SOURCE[0]}" | xargs realpath`

cd $script_directory

docker build -t adage-server/docker-interface-base -f Dockerfile.base .

docker build -t adage-server/docker-interface-build -f Dockerfile .

compile_folder="$script_directory/compile_folder"
bin_folder="$script_directory/bin"
build_folder="$script_directory/build"

# Set up mounting volume directory that will house bin and build folders
# if it doesn't already exist.
if [ -d "$compile_folder" ]
then
    rm -r $compile_folder
else
    mkdir $compile_folder
    chmod 775 $compile_folder
fi

# Remove previous bin and build folders if they already exist in the
# interface folder
if [ -d "$bin_folder" ]
then
    rm -r $bin_folder
fi

if [ -d "$build_folder" ]
then
    rm -r $build_folder
fi

# The reason we mount the parent "compile_folder" and then move the
# "bin" and "build" folders to the current directory is that Docker will
# not allow the mounting points or folders themselves to be deleted.
# However, deleting these folders is exactly what the "grunt" command needs
# to do right before it builds and compiles the interface files.
docker run \
      --volume $compile_folder:/home/user/compile_folder \
      adage-server/docker-interface-build

mv $compile_folder/bin .
mv $compile_folder/build .

rmdir $compile_folder
